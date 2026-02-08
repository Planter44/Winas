const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

const hasColumn = async (tableName, columnName) => {
    try {
        const result = await db.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND column_name = $2
             LIMIT 1`,
            [tableName, columnName]
        );
        return result.rows.length > 0;
    } catch (error) {
        return false;
    }
};

const sendMessage = async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        const senderId = req.user.id;
        const { subject, content, recipientIds, isBroadcast, departmentId } = req.body;

        if (!subject || !content) {
            return res.status(400).json({ error: 'Subject and content are required' });
        }

        await client.query('BEGIN');

        // Insert message
        const messageResult = await client.query(
            'INSERT INTO messages (sender_id, subject, content, is_broadcast) VALUES ($1, $2, $3, $4) RETURNING id',
            [senderId, subject, content, isBroadcast || false]
        );

        const messageId = messageResult.rows[0].id;

        if (isBroadcast && departmentId) {
            // Broadcast to department
            await client.query(
                'INSERT INTO message_broadcast_groups (message_id, department_id) VALUES ($1, $2)',
                [messageId, departmentId]
            );

            // Get all users in the department
            const usersResult = await client.query(
                'SELECT id FROM users WHERE department_id = $1 AND id != $2 AND deleted_at IS NULL',
                [departmentId, senderId]
            );

            // Create recipient records for all department users
            for (const user of usersResult.rows) {
                await client.query(
                    'INSERT INTO message_recipients (message_id, recipient_id) VALUES ($1, $2)',
                    [messageId, user.id]
                );
            }
        } else if (recipientIds && recipientIds.length > 0) {
            // Send to specific recipients
            for (const recipientId of recipientIds) {
                await client.query(
                    'INSERT INTO message_recipients (message_id, recipient_id) VALUES ($1, $2)',
                    [messageId, recipientId]
                );
            }
        } else {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Recipients are required' });
        }

        await client.query('COMMIT');

        await logAudit(senderId, 'SEND_MESSAGE', 'Message', messageId, 
            { subject, recipientCount: recipientIds?.length || 'broadcast' }, req);

        res.status(201).json({ 
            message: 'Message sent successfully',
            id: messageId 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    } finally {
        client.release();
    }
};

const getInbox = async (req, res) => {
    try {
        const userId = req.user.id;
        const { unreadOnly } = req.query;

        let query = `
            SELECT m.id, m.subject, m.content, m.is_broadcast, m.created_at,
                   mr.is_read, mr.read_at,
                   u.id as sender_id, sp.first_name as sender_first_name, 
                   sp.last_name as sender_last_name, r.name as sender_role
            FROM messages m
            INNER JOIN message_recipients mr ON m.id = mr.message_id
            INNER JOIN users u ON m.sender_id = u.id
            LEFT JOIN staff_profiles sp ON u.id = sp.user_id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE mr.recipient_id = $1 AND mr.deleted_at IS NULL AND m.deleted_at IS NULL
        `;

        const params = [userId];

        if (unreadOnly === 'true') {
            query += ' AND mr.is_read = false';
        }

        query += ' ORDER BY m.created_at DESC';

        const result = await db.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Get inbox error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

const getSent = async (req, res) => {
    try {
        const userId = req.user.id;

        const hasSenderDeletedAt = await hasColumn('messages', 'sender_deleted_at');
        const whereClauses = ['m.sender_id = $1', 'm.deleted_at IS NULL'];
        if (hasSenderDeletedAt) {
            whereClauses.push('m.sender_deleted_at IS NULL');
        }

        const result = await db.query(
            `SELECT m.id, m.subject, m.content, m.is_broadcast, m.created_at,
                    u.id as sender_id, sp.first_name as sender_first_name,
                    sp.last_name as sender_last_name, r.name as sender_role,
                    MAX(d.name) as broadcast_department,
                    CASE
                        WHEN m.is_broadcast THEN COALESCE(MAX(d.name), 'Broadcast')
                        ELSE COALESCE(
                            string_agg(
                                DISTINCT COALESCE(NULLIF(concat_ws(' ', rp.first_name, rp.last_name), ''), ru.email),
                                ', '
                            ),
                            ''
                        )
                    END as recipient_names,
                    COUNT(DISTINCT mr.recipient_id)::int as recipient_count
             FROM messages m
             LEFT JOIN message_recipients mr
                ON m.id = mr.message_id
             LEFT JOIN users ru ON mr.recipient_id = ru.id
             LEFT JOIN staff_profiles rp ON ru.id = rp.user_id
             LEFT JOIN message_broadcast_groups mbg ON mbg.message_id = m.id
             LEFT JOIN departments d ON mbg.department_id = d.id
             INNER JOIN users u ON m.sender_id = u.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE ${whereClauses.join(' AND ')}
             GROUP BY m.id, u.id, sp.first_name, sp.last_name, r.name
             ORDER BY m.created_at DESC`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get sent messages error:', error);
        res.status(500).json({ error: 'Failed to fetch sent messages' });
    }
};

const getMessageById = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await db.query(
            `SELECT m.id, m.subject, m.content, m.is_broadcast, m.created_at,
                    mr.is_read, mr.read_at,
                    u.id as sender_id, sp.first_name as sender_first_name, 
                    sp.last_name as sender_last_name, r.name as sender_role
             FROM messages m
             INNER JOIN message_recipients mr ON m.id = mr.message_id
             INNER JOIN users u ON m.sender_id = u.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE m.id = $1 AND mr.recipient_id = $2 AND mr.deleted_at IS NULL AND m.deleted_at IS NULL`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Mark as read
        if (!result.rows[0].is_read) {
            await db.query(
                'UPDATE message_recipients SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE message_id = $1 AND recipient_id = $2',
                [id, userId]
            );
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get message error:', error);
        res.status(500).json({ error: 'Failed to fetch message' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(
            `SELECT COUNT(*) as unread_count
             FROM message_recipients mr
             INNER JOIN messages m ON mr.message_id = m.id
             WHERE mr.recipient_id = $1 AND mr.is_read = false 
                   AND mr.deleted_at IS NULL AND m.deleted_at IS NULL`,
            [userId]
        );

        res.json({ unreadCount: parseInt(result.rows[0].unread_count) });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
};

const markAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await db.query(
            'UPDATE message_recipients SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE message_id = $1 AND recipient_id = $2',
            [id, userId]
        );

        res.json({ message: 'Message marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
};

const deleteMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const senderResult = await db.query(
            'UPDATE messages SET sender_deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND sender_id = $2 AND sender_deleted_at IS NULL RETURNING id',
            [id, userId]
        );

        if (senderResult.rowCount > 0) {
            return res.json({ message: 'Message deleted successfully' });
        }

        const recipientResult = await db.query(
            'UPDATE message_recipients SET deleted_at = CURRENT_TIMESTAMP WHERE message_id = $1 AND recipient_id = $2 AND deleted_at IS NULL RETURNING id',
            [id, userId]
        );

        if (recipientResult.rowCount === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};

module.exports = {
    sendMessage,
    getInbox,
    getSent,
    getMessageById,
    getUnreadCount,
    markAsRead,
    deleteMessage
};
