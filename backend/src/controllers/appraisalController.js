const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

const createAppraisal = async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        const { userId, periodType, periodYear, periodQuarter, scores } = req.body;
        const supervisorId = req.user.id;

        if (!userId || !periodType || !periodYear) {
            return res.status(400).json({ 
                error: 'User ID, period type, and year are required' 
            });
        }

        if (periodType === 'Quarterly' && !periodQuarter) {
            return res.status(400).json({ error: 'Quarter is required for quarterly appraisals' });
        }

        await client.query('BEGIN');

        const existing = await client.query(
            `SELECT id FROM appraisals 
             WHERE user_id = $1 AND period_type = $2 AND period_year = $3 
                   AND period_quarter = $4 AND deleted_at IS NULL`,
            [userId, periodType, periodYear, periodQuarter || null]
        );

        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ 
                error: 'Appraisal already exists for this period' 
            });
        }

        const result = await client.query(
            `INSERT INTO appraisals 
             (user_id, supervisor_id, period_type, period_year, period_quarter, status)
             VALUES ($1, $2, $3, $4, $5, 'Draft') RETURNING id`,
            [userId, supervisorId, periodType, periodYear, periodQuarter || null]
        );

        const appraisalId = result.rows[0].id;

        if (scores && Array.isArray(scores)) {
            for (const score of scores) {
                await client.query(
                    `INSERT INTO appraisal_scores (appraisal_id, criteria, score, comment)
                     VALUES ($1, $2, $3, $4)`,
                    [appraisalId, score.criteria, score.score, score.comment || null]
                );
            }

            const avgResult = await client.query(
                'SELECT AVG(score)::DECIMAL(3,2) as avg_score FROM appraisal_scores WHERE appraisal_id = $1',
                [appraisalId]
            );

            await client.query(
                'UPDATE appraisals SET overall_score = $1 WHERE id = $2',
                [avgResult.rows[0].avg_score, appraisalId]
            );
        }

        await client.query('COMMIT');

        await logAudit(supervisorId, 'CREATE_APPRAISAL', 'Appraisal', appraisalId, 
            { userId, periodType }, req);

        res.status(201).json({ 
            message: 'Appraisal created successfully',
            id: appraisalId 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create appraisal error:', error);
        res.status(500).json({ error: 'Failed to create appraisal' });
    } finally {
        client.release();
    }
};

const getAppraisals = async (req, res) => {
    try {
        const { userId, periodType, periodYear, status } = req.query;
        const currentUser = req.user;

        let query = `
            SELECT a.*, 
                   u.email as user_email,
                   sp.first_name, sp.last_name, sp.employee_number, sp.job_title,
                   d.name as department_name,
                   sup.first_name as supervisor_first_name,
                   sup.last_name as supervisor_last_name,
                   hr.first_name as hr_first_name,
                   hr.last_name as hr_last_name
            FROM appraisals a
            JOIN users u ON a.user_id = u.id
            JOIN staff_profiles sp ON u.id = sp.user_id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN staff_profiles sup ON a.supervisor_id = sup.user_id
            LEFT JOIN staff_profiles hr ON a.hr_id = hr.user_id
            WHERE a.deleted_at IS NULL
        `;

        const params = [];
        let paramCount = 1;

        if (currentUser.role_name === 'Staff') {
            query += ` AND a.user_id = $${paramCount}`;
            params.push(currentUser.id);
            paramCount++;
        } else if (currentUser.role_name === 'Supervisor') {
            query += ` AND (a.supervisor_id = $${paramCount} OR a.user_id = $${paramCount})`;
            params.push(currentUser.id);
            paramCount++;
        } else if (currentUser.role_name === 'HOD') {
            query += ` AND u.department_id = $${paramCount}`;
            params.push(currentUser.department_id);
            paramCount++;
        }

        if (userId) {
            query += ` AND a.user_id = $${paramCount}`;
            params.push(userId);
            paramCount++;
        }

        if (periodType) {
            query += ` AND a.period_type = $${paramCount}`;
            params.push(periodType);
            paramCount++;
        }

        if (periodYear) {
            query += ` AND a.period_year = $${paramCount}`;
            params.push(periodYear);
            paramCount++;
        }

        if (status) {
            query += ` AND a.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        query += ' ORDER BY a.period_year DESC, a.period_quarter DESC, a.created_at DESC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get appraisals error:', error);
        res.status(500).json({ error: 'Failed to fetch appraisals' });
    }
};

const getAppraisalById = async (req, res) => {
    try {
        const { id } = req.params;

        const appraisal = await db.query(
            `SELECT a.*, 
                   u.email as user_email,
                   sp.first_name, sp.last_name, sp.employee_number, sp.job_title,
                   d.name as department_name,
                   sup.first_name as supervisor_first_name,
                   sup.last_name as supervisor_last_name,
                   hr.first_name as hr_first_name,
                   hr.last_name as hr_last_name
            FROM appraisals a
            JOIN users u ON a.user_id = u.id
            JOIN staff_profiles sp ON u.id = sp.user_id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN staff_profiles sup ON a.supervisor_id = sup.user_id
            LEFT JOIN staff_profiles hr ON a.hr_id = hr.user_id
            WHERE a.id = $1 AND a.deleted_at IS NULL`,
            [id]
        );

        if (appraisal.rows.length === 0) {
            return res.status(404).json({ error: 'Appraisal not found' });
        }

        const scores = await db.query(
            'SELECT * FROM appraisal_scores WHERE appraisal_id = $1 ORDER BY id',
            [id]
        );

        res.json({
            ...appraisal.rows[0],
            scores: scores.rows
        });
    } catch (error) {
        console.error('Get appraisal error:', error);
        res.status(500).json({ error: 'Failed to fetch appraisal' });
    }
};

const updateAppraisal = async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        const { id } = req.params;
        const { status, supervisorComment, hrComment, scores } = req.body;

        await client.query('BEGIN');

        const appraisalResult = await client.query(
            'SELECT * FROM appraisals WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (appraisalResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Appraisal not found' });
        }

        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (status !== undefined) {
            updateFields.push(`status = $${paramCount++}`);
            updateValues.push(status);
            
            if (status === 'Finalized') {
                updateFields.push(`finalized_at = CURRENT_TIMESTAMP`);
                if (req.user.role_name === 'HR' || req.user.role_name === 'Super Admin') {
                    updateFields.push(`hr_id = $${paramCount++}`);
                    updateValues.push(req.user.id);
                }
            }
        }

        if (supervisorComment !== undefined) {
            updateFields.push(`supervisor_comment = $${paramCount++}`);
            updateValues.push(supervisorComment);
        }

        if (hrComment !== undefined) {
            updateFields.push(`hr_comment = $${paramCount++}`);
            updateValues.push(hrComment);
        }

        updateValues.push(id);

        if (updateFields.length > 0) {
            await client.query(
                `UPDATE appraisals SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $${paramCount}`,
                updateValues
            );
        }

        if (scores && Array.isArray(scores)) {
            await client.query('DELETE FROM appraisal_scores WHERE appraisal_id = $1', [id]);

            for (const score of scores) {
                await client.query(
                    `INSERT INTO appraisal_scores (appraisal_id, criteria, score, comment)
                     VALUES ($1, $2, $3, $4)`,
                    [id, score.criteria, score.score, score.comment || null]
                );
            }

            const avgResult = await client.query(
                'SELECT AVG(score)::DECIMAL(3,2) as avg_score FROM appraisal_scores WHERE appraisal_id = $1',
                [id]
            );

            await client.query(
                'UPDATE appraisals SET overall_score = $1 WHERE id = $2',
                [avgResult.rows[0].avg_score, id]
            );
        }

        await client.query('COMMIT');

        await logAudit(req.user.id, 'UPDATE_APPRAISAL', 'Appraisal', id, req.body, req);

        res.json({ message: 'Appraisal updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update appraisal error:', error);
        res.status(500).json({ error: 'Failed to update appraisal' });
    } finally {
        client.release();
    }
};

const deleteAppraisal = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'UPDATE appraisals SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        await logAudit(req.user.id, 'DELETE_APPRAISAL', 'Appraisal', id, {}, req);

        res.json({ message: 'Appraisal deleted successfully' });
    } catch (error) {
        console.error('Delete appraisal error:', error);
        res.status(500).json({ error: 'Failed to delete appraisal' });
    }
};

const getAppraisalCriteria = async (req, res) => {
    try {
        const defaultCriteria = [
            { name: 'Attendance', description: 'Punctuality and attendance record' },
            { name: 'Work Quality', description: 'Quality of work delivered' },
            { name: 'Teamwork', description: 'Collaboration with team members' },
            { name: 'Communication', description: 'Effective communication skills' },
            { name: 'Initiative', description: 'Proactive approach to work' },
            { name: 'Goal Achievement', description: 'Meeting targets and objectives' }
        ];

        res.json(defaultCriteria);
    } catch (error) {
        console.error('Get criteria error:', error);
        res.status(500).json({ error: 'Failed to fetch appraisal criteria' });
    }
};

module.exports = {
    createAppraisal,
    getAppraisals,
    getAppraisalById,
    updateAppraisal,
    deleteAppraisal,
    getAppraisalCriteria
};
