const db = require('../database/db');
const { logAudit } = require('../middleware/audit');
const { isCloudinaryConfigured, uploadBuffer } = require('../utils/cloudinary');

const createLeaveRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const { leaveTypeId, startDate, endDate, reason } = req.body;
        
        // Handle file upload - if file is uploaded, use its path; otherwise use documentUrl from body
        let documentUrl = req.body.documentUrl || null;
        if (req.file) {
            if (isCloudinaryConfigured()) {
                const folder = process.env.CLOUDINARY_FOLDER || 'winas-hrms/leave-documents';
                const uploadRes = await uploadBuffer(req.file.buffer, {
                    folder,
                    public_id: `leave-doc-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
                    original_filename: req.file.originalname
                });
                documentUrl = uploadRes.secure_url;
            } else {
                documentUrl = `/uploads/leave-documents/${req.file.filename}`;
            }
        }

        if (!leaveTypeId || !startDate || !endDate || !reason) {
            return res.status(400).json({ 
                error: 'Leave type, dates, and reason are required' 
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (daysRequested <= 0) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        const userRoleResult = await db.query(
            `SELECT u.supervisor_id, u.department_id, r.name as role_name 
             FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
            [userId]
        );

        const userRole = userRoleResult.rows[0].role_name;
        const userDepartmentId = userRoleResult.rows[0].department_id;
        const requiresCEOApproval = (userRole === 'HR' || userRole === 'HOD');
        
        let supervisorId = userRoleResult.rows[0].supervisor_id;
        
        // For Supervisors, ALWAYS find the HOD of their department to approve their leave
        // This ensures Supervisors don't get their own leave notifications
        if (userRole === 'Supervisor' && userDepartmentId) {
            const hodResult = await db.query(
                `SELECT u.id FROM users u 
                 JOIN roles r ON u.role_id = r.id 
                 WHERE u.department_id = $1 AND r.name = 'HOD' AND u.deleted_at IS NULL`,
                [userDepartmentId]
            );
            if (hodResult.rows.length > 0) {
                supervisorId = hodResult.rows[0].id;
            } else {
                // No HOD found, set to null so it will be caught by the error below
                supervisorId = null;
            }
        }

        if (!requiresCEOApproval && !supervisorId) {
            return res.status(400).json({ 
                error: 'No supervisor or HOD assigned. Please contact HR.' 
            });
        }

        const result = await db.query(
            `INSERT INTO leave_requests 
             (user_id, leave_type_id, start_date, end_date, days_requested, reason, 
              supervisor_id, supervisor_status, document_url, status, requires_ceo_approval)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', $10)
             RETURNING id`,
            [userId, leaveTypeId, startDate, endDate, daysRequested, reason, 
             requiresCEOApproval ? null : supervisorId,
             requiresCEOApproval ? 'Not Required' : 'Pending',
             documentUrl, requiresCEOApproval]
        );

        await logAudit(userId, 'CREATE_LEAVE_REQUEST', 'Leave', result.rows[0].id, 
            { leaveTypeId, startDate, endDate }, req);

        res.status(201).json({ 
            message: 'Leave request submitted successfully',
            id: result.rows[0].id 
        });
    } catch (error) {
        console.error('Create leave request error:', error);
        res.status(500).json({ error: 'Failed to create leave request' });
    }
};

const getLeaveRequests = async (req, res) => {
    try {
        const { status, userId, departmentId } = req.query;
        const currentUser = req.user;

        let query = `
            SELECT lr.*, lt.name as leave_type_name,
                   u.email as user_email,
                   sp.first_name, sp.last_name, sp.employee_number,
                   d.name as department_name,
                   r.name as applicant_role,
                   sup.first_name as supervisor_first_name,
                   sup.last_name as supervisor_last_name,
                   hr.first_name as hr_first_name,
                   hr.last_name as hr_last_name
            FROM leave_requests lr
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            JOIN users u ON lr.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            JOIN staff_profiles sp ON u.id = sp.user_id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN staff_profiles sup ON lr.supervisor_id = sup.user_id
            LEFT JOIN staff_profiles hr ON lr.hr_id = hr.user_id
            WHERE lr.deleted_at IS NULL
        `;

        const params = [];
        let paramCount = 1;

        if (currentUser.role_name === 'Staff') {
            query += ` AND lr.user_id = $${paramCount}`;
            params.push(currentUser.id);
            paramCount++;
        } else if (currentUser.role_name === 'Supervisor') {
            query += ` AND (lr.supervisor_id = $${paramCount} OR lr.user_id = $${paramCount})`;
            params.push(currentUser.id);
            paramCount++;
        } else if (currentUser.role_name === 'HOD') {
            query += ` AND u.department_id = $${paramCount}`;
            params.push(currentUser.department_id);
            paramCount++;
        }

        if (status) {
            query += ` AND lr.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        if (userId) {
            query += ` AND lr.user_id = $${paramCount}`;
            params.push(userId);
            paramCount++;
        }

        if (departmentId) {
            query += ` AND u.department_id = $${paramCount}`;
            params.push(departmentId);
            paramCount++;
        }

        query += ' ORDER BY lr.created_at DESC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get leave requests error:', error);
        res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
};

const getLeaveRequestById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT lr.*, lt.name as leave_type_name, lt.days_allowed,
                   u.email as user_email,
                   sp.first_name, sp.last_name, sp.employee_number, sp.job_title,
                   d.name as department_name,
                   r.name as applicant_role,
                   sup.first_name as supervisor_first_name,
                   sup.last_name as supervisor_last_name,
                   hr.first_name as hr_first_name,
                   hr.last_name as hr_last_name
            FROM leave_requests lr
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            JOIN users u ON lr.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            JOIN staff_profiles sp ON u.id = sp.user_id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN staff_profiles sup ON lr.supervisor_id = sup.user_id
            LEFT JOIN staff_profiles hr ON lr.hr_id = hr.user_id
            WHERE lr.id = $1 AND lr.deleted_at IS NULL`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get leave request error:', error);
        res.status(500).json({ error: 'Failed to fetch leave request' });
    }
};

const supervisorActionOnLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, comment } = req.body;
        const actingUserId = req.user.id;
        const actingUserRole = req.user.role;

        if (!['Approved', 'Rejected'].includes(action)) {
            return res.status(400).json({ error: 'Action must be Approved or Rejected' });
        }

        // Get leave request with applicant info
        const leaveResult = await db.query(
            `SELECT lr.*, r.name as applicant_role, u.department_id as applicant_dept_id
             FROM leave_requests lr
             JOIN users u ON lr.user_id = u.id
             JOIN roles r ON u.role_id = r.id
             WHERE lr.id = $1 AND lr.deleted_at IS NULL`,
            [id]
        );

        if (leaveResult.rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        const leave = leaveResult.rows[0];
        
        // Check if user can act on this leave:
        // 1. Assigned supervisor can act
        // 2. HOD can act on Supervisor leaves in their department
        let canAct = leave.supervisor_id === actingUserId;
        
        if (!canAct && actingUserRole === 'HOD' && leave.applicant_role === 'Supervisor') {
            // Check if HOD is in the same department as the Supervisor
            const hodDeptResult = await db.query(
                'SELECT department_id FROM users WHERE id = $1',
                [actingUserId]
            );
            if (hodDeptResult.rows.length > 0 && 
                hodDeptResult.rows[0].department_id === leave.applicant_dept_id) {
                canAct = true;
            }
        }

        if (!canAct) {
            return res.status(403).json({ 
                error: 'You are not authorized to act on this leave request' 
            });
        }

        if (leave.supervisor_status !== 'Pending') {
            return res.status(400).json({ 
                error: 'Leave request has already been processed' 
            });
        }

        let status = action === 'Rejected' ? 'Rejected' : 'Pending';
        
        await db.query(
            `UPDATE leave_requests 
             SET supervisor_id = $1, supervisor_status = $2, supervisor_comment = $3, 
                 supervisor_action_at = CURRENT_TIMESTAMP, status = $4
             WHERE id = $5`,
            [actingUserId, action, comment, status, id]
        );

        await logAudit(actingUserId, 'SUPERVISOR_LEAVE_ACTION', 'Leave', id, 
            { action, comment }, req);

        res.json({ 
            message: `Leave request ${action.toLowerCase()} by supervisor`,
            nextStep: action === 'Approved' ? 'Forwarded to HR for final approval' : 'Request rejected'
        });
    } catch (error) {
        console.error('Supervisor action error:', error);
        res.status(500).json({ error: 'Failed to process leave request' });
    }
};

const hrActionOnLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, comment } = req.body;
        const hrId = req.user.id;

        if (!['Approved', 'Rejected'].includes(action)) {
            return res.status(400).json({ error: 'Action must be Approved or Rejected' });
        }

        const leaveResult = await db.query(
            'SELECT * FROM leave_requests WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (leaveResult.rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        if (leaveResult.rows[0].supervisor_status !== 'Approved') {
            return res.status(400).json({ 
                error: 'Leave must be approved by supervisor first' 
            });
        }

        // HR can override their decision (no check for already processed)
        await db.query(
            `UPDATE leave_requests 
             SET hr_id = $1, hr_status = $2, hr_comment = $3, 
                 hr_action_at = CURRENT_TIMESTAMP, status = $2
             WHERE id = $4`,
            [hrId, action, comment, id]
        );

        await logAudit(hrId, 'HR_LEAVE_ACTION', 'Leave', id, { action, comment }, req);

        res.json({ 
            message: `Leave request ${action.toLowerCase()} by HR`,
            finalStatus: action
        });
    } catch (error) {
        console.error('HR action error:', error);
        res.status(500).json({ error: 'Failed to process leave request' });
    }
};

const ceoActionOnLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, comment } = req.body;
        const ceoId = req.user.id;

        if (!['Approved', 'Rejected'].includes(action)) {
            return res.status(400).json({ error: 'Action must be Approved or Rejected' });
        }

        const leaveResult = await db.query(
            'SELECT * FROM leave_requests WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (leaveResult.rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        const leave = leaveResult.rows[0];

        if (!leave.requires_ceo_approval) {
            return res.status(400).json({ 
                error: 'This leave request does not require CEO approval' 
            });
        }

        // CEO can override their decision (no check for already processed)
        await db.query(
            `UPDATE leave_requests 
             SET ceo_id = $1, ceo_status = $2, ceo_comment = $3, 
                 ceo_response_date = CURRENT_TIMESTAMP, status = $2
             WHERE id = $4`,
            [ceoId, action, comment, id]
        );

        await logAudit(ceoId, 'CEO_LEAVE_ACTION', 'Leave', id, { action, comment }, req);

        res.json({ 
            message: `Leave request ${action.toLowerCase()} by CEO`,
            finalStatus: action
        });
    } catch (error) {
        console.error('CEO action error:', error);
        res.status(500).json({ error: 'Failed to process leave request' });
    }
};

const getLeaveBalance = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const currentYear = new Date().getFullYear();

        const leaveTypes = await db.query(
            'SELECT id, name, days_allowed FROM leave_types WHERE is_active = true AND deleted_at IS NULL'
        );

        // Get approved leaves
        const usedLeave = await db.query(
            `SELECT leave_type_id, SUM(days_requested) as days_used
             FROM leave_requests
             WHERE user_id = $1 AND status = 'Approved' 
                   AND EXTRACT(YEAR FROM start_date) = $2
             GROUP BY leave_type_id`,
            [userId, currentYear]
        );

        // Get pending leaves (not yet approved but still count against balance)
        const pendingLeave = await db.query(
            `SELECT leave_type_id, SUM(days_requested) as days_pending
             FROM leave_requests
             WHERE user_id = $1 AND status = 'Pending' 
                   AND EXTRACT(YEAR FROM start_date) = $2
             GROUP BY leave_type_id`,
            [userId, currentYear]
        );

        const usedMap = {};
        usedLeave.rows.forEach(row => {
            usedMap[row.leave_type_id] = parseInt(row.days_used);
        });

        const pendingMap = {};
        pendingLeave.rows.forEach(row => {
            pendingMap[row.leave_type_id] = parseInt(row.days_pending);
        });

        const balance = leaveTypes.rows.map(type => {
            const daysUsed = usedMap[type.id] || 0;
            const daysPending = pendingMap[type.id] || 0;
            const daysRemaining = type.days_allowed - daysUsed - daysPending;
            return {
                leaveTypeId: type.id,
                leaveTypeName: type.name,
                totalAllowed: type.days_allowed,
                daysUsed: daysUsed,
                daysPending: daysPending,
                daysRemaining: daysRemaining > 0 ? daysRemaining : 0
            };
        });

        res.json({ year: currentYear, balance });
    } catch (error) {
        console.error('Get leave balance error:', error);
        res.status(500).json({ error: 'Failed to fetch leave balance' });
    }
};

const getLeaveTypes = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM leave_types 
             WHERE is_active = true AND deleted_at IS NULL 
             ORDER BY name`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get leave types error:', error);
        res.status(500).json({ error: 'Failed to fetch leave types' });
    }
};

const createLeaveType = async (req, res) => {
    try {
        const { name, description, daysAllowed, requiresDocument, isPaid, carryForward } = req.body;

        if (!name || daysAllowed === undefined) {
            return res.status(400).json({ error: 'Name and days allowed are required' });
        }

        const result = await db.query(
            `INSERT INTO leave_types 
             (name, description, days_allowed, requires_document, is_paid, carry_forward)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [name, description, daysAllowed, requiresDocument || false, 
             isPaid !== false, carryForward || false]
        );

        await logAudit(req.user.id, 'CREATE_LEAVE_TYPE', 'LeaveType', result.rows[0].id, 
            { name, daysAllowed }, req);

        res.status(201).json({ 
            message: 'Leave type created successfully',
            id: result.rows[0].id 
        });
    } catch (error) {
        console.error('Create leave type error:', error);
        res.status(500).json({ error: 'Failed to create leave type' });
    }
};

const updateLeaveType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, daysAllowed, requiresDocument, isPaid, carryForward, isActive } = req.body;

        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (name !== undefined) {
            updateFields.push(`name = $${paramCount++}`);
            updateValues.push(name);
        }
        if (description !== undefined) {
            updateFields.push(`description = $${paramCount++}`);
            updateValues.push(description);
        }
        if (daysAllowed !== undefined) {
            updateFields.push(`days_allowed = $${paramCount++}`);
            updateValues.push(daysAllowed);
        }
        if (requiresDocument !== undefined) {
            updateFields.push(`requires_document = $${paramCount++}`);
            updateValues.push(requiresDocument);
        }
        if (isPaid !== undefined) {
            updateFields.push(`is_paid = $${paramCount++}`);
            updateValues.push(isPaid);
        }
        if (carryForward !== undefined) {
            updateFields.push(`carry_forward = $${paramCount++}`);
            updateValues.push(carryForward);
        }
        if (isActive !== undefined) {
            updateFields.push(`is_active = $${paramCount++}`);
            updateValues.push(isActive);
        }

        updateValues.push(id);

        await db.query(
            `UPDATE leave_types SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${paramCount}`,
            updateValues
        );

        await logAudit(req.user.id, 'UPDATE_LEAVE_TYPE', 'LeaveType', id, req.body, req);

        res.json({ message: 'Leave type updated successfully' });
    } catch (error) {
        console.error('Update leave type error:', error);
        res.status(500).json({ error: 'Failed to update leave type' });
    }
};

const deleteLeaveType = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'UPDATE leave_types SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        await logAudit(req.user.id, 'DELETE_LEAVE_TYPE', 'LeaveType', id, {}, req);

        res.json({ message: 'Leave type deleted successfully' });
    } catch (error) {
        console.error('Delete leave type error:', error);
        res.status(500).json({ error: 'Failed to delete leave type' });
    }
};

const cancelLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const leaveResult = await db.query(
            'SELECT * FROM leave_requests WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, userId]
        );

        if (leaveResult.rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found or you do not have permission' });
        }

        const leave = leaveResult.rows[0];

        // For HR/HOD leaves that go directly to CEO, check ceo_status
        // For regular leaves, check supervisor_status
        if (leave.requires_ceo_approval) {
            // HR/HOD leaves - can cancel if CEO hasn't acted
            if (leave.ceo_status && leave.ceo_status !== 'Pending') {
                return res.status(400).json({ error: 'Cannot cancel leave that has already been reviewed by CEO' });
            }
        } else {
            // Regular leaves - can cancel if supervisor hasn't acted
            if (leave.supervisor_status && leave.supervisor_status !== 'Pending') {
                return res.status(400).json({ error: 'Cannot cancel leave that has already been reviewed' });
            }
        }

        await db.query(
            'UPDATE leave_requests SET status = $1, deleted_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['Cancelled', id]
        );

        await logAudit(userId, 'CANCEL_LEAVE', 'Leave', id, {}, req);

        res.json({ message: 'Leave request cancelled successfully' });
    } catch (error) {
        console.error('Cancel leave error:', error);
        res.status(500).json({ error: 'Failed to cancel leave request' });
    }
};

const updateLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { startDate, endDate, reason, documentUrl } = req.body;

        const leaveResult = await db.query(
            'SELECT * FROM leave_requests WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
            [id, userId]
        );

        if (leaveResult.rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found or you do not have permission' });
        }

        const leave = leaveResult.rows[0];

        // For HR/HOD leaves that go directly to CEO, check ceo_status
        // For regular leaves, check supervisor_status
        if (leave.requires_ceo_approval) {
            // HR/HOD leaves - can edit if CEO hasn't acted
            if (leave.ceo_status && leave.ceo_status !== 'Pending') {
                return res.status(400).json({ error: 'Cannot edit leave that has already been reviewed by CEO' });
            }
        } else {
            // Regular leaves - can edit if supervisor hasn't acted
            if (leave.supervisor_status && leave.supervisor_status !== 'Pending') {
                return res.status(400).json({ error: 'Cannot edit leave that has already been reviewed' });
            }
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        await db.query(
            `UPDATE leave_requests 
             SET start_date = $1, end_date = $2, days_requested = $3, reason = $4, 
                 document_url = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [startDate, endDate, daysRequested, reason, documentUrl, id]
        );

        await logAudit(userId, 'UPDATE_LEAVE', 'Leave', id, { startDate, endDate, daysRequested }, req);

        res.json({ message: 'Leave request updated successfully' });
    } catch (error) {
        console.error('Update leave error:', error);
        res.status(500).json({ error: 'Failed to update leave request' });
    }
};

const uploadLeaveDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let documentUrl = `/uploads/leave-documents/${req.file.filename}`;
        if (isCloudinaryConfigured()) {
            const folder = process.env.CLOUDINARY_FOLDER || 'winas-hrms/leave-documents';
            const uploadRes = await uploadBuffer(req.file.buffer, {
                folder,
                public_id: `leave-doc-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
                original_filename: req.file.originalname
            });
            documentUrl = uploadRes.secure_url;
        }
        
        res.json({ 
            message: 'Document uploaded successfully',
            documentUrl: documentUrl,
            filename: req.file.originalname
        });
    } catch (error) {
        console.error('Upload document error:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

module.exports = {
    createLeaveRequest,
    getLeaveRequests,
    getLeaveRequestById,
    supervisorActionOnLeave,
    hrActionOnLeave,
    ceoActionOnLeave,
    cancelLeave,
    updateLeave,
    getLeaveBalance,
    getLeaveTypes,
    createLeaveType,
    updateLeaveType,
    deleteLeaveType,
    uploadLeaveDocument
};
