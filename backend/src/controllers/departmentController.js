const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

const getAllDepartments = async (req, res) => {
    try {
        const { isActive } = req.query;

        let query = 'SELECT * FROM departments WHERE deleted_at IS NULL';
        const params = [];

        if (isActive !== undefined) {
            query += ' AND is_active = $1';
            params.push(isActive === 'true');
        }

        query += ' ORDER BY name';

        const result = await db.query(query, params);

        const departmentsWithStats = await Promise.all(
            result.rows.map(async (dept) => {
                const stats = await db.query(
                    `SELECT COUNT(*) as staff_count
                     FROM users 
                     WHERE department_id = $1 AND is_active = true AND deleted_at IS NULL`,
                    [dept.id]
                );

                return {
                    ...dept,
                    staffCount: parseInt(stats.rows[0].staff_count)
                };
            })
        );

        res.json(departmentsWithStats);
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'SELECT * FROM departments WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }

        const staff = await db.query(
            `SELECT u.id, u.email, u.is_active,
                    sp.first_name, sp.last_name, sp.employee_number, sp.job_title,
                    r.name as role_name
             FROM users u
             JOIN staff_profiles sp ON u.id = sp.user_id
             JOIN roles r ON u.role_id = r.id
             WHERE u.department_id = $1 AND u.deleted_at IS NULL
             ORDER BY r.level, sp.first_name`,
            [id]
        );

        res.json({
            ...result.rows[0],
            staff: staff.rows
        });
    } catch (error) {
        console.error('Get department error:', error);
        res.status(500).json({ error: 'Failed to fetch department' });
    }
};

const createDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Department name is required' });
        }

        const existing = await db.query(
            'SELECT id FROM departments WHERE name = $1 AND deleted_at IS NULL',
            [name]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Department already exists' });
        }

        const result = await db.query(
            'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING id',
            [name, description]
        );

        await logAudit(req.user.id, 'CREATE_DEPARTMENT', 'Department', result.rows[0].id, 
            { name }, req);

        res.status(201).json({ 
            message: 'Department created successfully',
            id: result.rows[0].id 
        });
    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({ error: 'Failed to create department' });
    }
};

const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;

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

        if (isActive !== undefined) {
            updateFields.push(`is_active = $${paramCount++}`);
            updateValues.push(isActive);
        }

        updateValues.push(id);

        await db.query(
            `UPDATE departments SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${paramCount}`,
            updateValues
        );

        await logAudit(req.user.id, 'UPDATE_DEPARTMENT', 'Department', id, req.body, req);

        res.json({ message: 'Department updated successfully' });
    } catch (error) {
        console.error('Update department error:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
};

const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;

        const staffCount = await db.query(
            'SELECT COUNT(*) as count FROM users WHERE department_id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (parseInt(staffCount.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete department with active staff members' 
            });
        }

        await db.query(
            'UPDATE departments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        await logAudit(req.user.id, 'DELETE_DEPARTMENT', 'Department', id, {}, req);

        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        console.error('Delete department error:', error);
        res.status(500).json({ error: 'Failed to delete department' });
    }
};

const getRoles = async (req, res) => {
    try {
        const requestingUserRole = req.user.role_name;
        
        let query = 'SELECT id, name, description, level FROM roles';
        
        if (requestingUserRole === 'Super Admin') {
            // SuperAdmin can see all roles
            query += ' ORDER BY level ASC';
        } else if (requestingUserRole === 'CEO') {
            // CEO can see CEO role (for editing themselves) but not SuperAdmin
            query += ' WHERE name != \'Super Admin\' ORDER BY level ASC';
        } else {
            // HR and others cannot see CEO or SuperAdmin roles
            query += ' WHERE name NOT IN (\'Super Admin\', \'CEO\') ORDER BY level ASC';
        }
        
        const result = await db.query(query);

        res.json(result.rows);
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
};

module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getRoles
};
