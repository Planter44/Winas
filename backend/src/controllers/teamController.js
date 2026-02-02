const db = require('../database/db');

const getMyTeam = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role_name;

        // Get user's department
        const userResult = await db.query(
            'SELECT department_id, role_id FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { department_id, role_id } = userResult.rows[0];

        let teamMembers = [];

        if (userRole === 'HOD') {
            // HOD sees supervisors and staff in their department
            const result = await db.query(
                `SELECT u.id, u.email, u.is_active, u.last_login,
                        r.name as role_name, r.level as role_level,
                        d.name as department_name,
                        sp.first_name, sp.last_name, sp.employee_number, 
                        sp.job_title, sp.phone, sp.gender
                 FROM users u
                 JOIN roles r ON u.role_id = r.id
                 LEFT JOIN departments d ON u.department_id = d.id
                 LEFT JOIN staff_profiles sp ON u.id = sp.user_id
                 WHERE u.department_id = $1 
                   AND r.name IN ('Supervisor', 'Staff')
                   AND u.deleted_at IS NULL
                 ORDER BY r.level, sp.first_name`,
                [department_id]
            );
            teamMembers = result.rows;
        } else if (userRole === 'Supervisor') {
            // Supervisor sees staff they supervise
            const result = await db.query(
                `SELECT u.id, u.email, u.is_active, u.last_login,
                        r.name as role_name, r.level as role_level,
                        d.name as department_name,
                        sp.first_name, sp.last_name, sp.employee_number, 
                        sp.job_title, sp.phone, sp.gender
                 FROM users u
                 JOIN roles r ON u.role_id = r.id
                 LEFT JOIN departments d ON u.department_id = d.id
                 LEFT JOIN staff_profiles sp ON u.id = sp.user_id
                 WHERE u.supervisor_id = $1 
                   AND u.deleted_at IS NULL
                 ORDER BY sp.first_name`,
                [userId]
            );
            teamMembers = result.rows;
        } else if (userRole === 'HR') {
            // HR sees all departments
            const result = await db.query(
                `SELECT d.id, d.name, d.description,
                        (SELECT COUNT(*) FROM users WHERE department_id = d.id AND deleted_at IS NULL) as member_count
                 FROM departments d
                 WHERE d.deleted_at IS NULL
                 ORDER BY d.name`
            );
            return res.json({ departments: result.rows });
        } else if (userRole === 'CEO') {
            // CEO sees all departments and HR
            const deptResult = await db.query(
                `SELECT d.id, d.name, d.description,
                        (SELECT COUNT(*) FROM users WHERE department_id = d.id AND deleted_at IS NULL) as member_count
                 FROM departments d
                 WHERE d.deleted_at IS NULL
                 ORDER BY d.name`
            );

            const hrResult = await db.query(
                `SELECT u.id, u.email, u.is_active, u.last_login,
                        r.name as role_name, r.level as role_level,
                        sp.first_name, sp.last_name, sp.employee_number, 
                        sp.job_title, sp.phone, sp.gender
                 FROM users u
                 JOIN roles r ON u.role_id = r.id
                 LEFT JOIN staff_profiles sp ON u.id = sp.user_id
                 WHERE r.name = 'HR' AND u.deleted_at IS NULL
                 ORDER BY sp.first_name`
            );

            return res.json({ 
                departments: deptResult.rows,
                hrStaff: hrResult.rows
            });
        }

        res.json({ teamMembers });
    } catch (error) {
        console.error('Get my team error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: 'Failed to fetch team members', details: error.message });
    }
};

const getDepartmentMembers = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const userRole = req.user.role_name;

        // Only HR and CEO can view department members
        if (!['HR', 'CEO', 'Super Admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const result = await db.query(
            `SELECT u.id, u.email, u.is_active, u.supervisor_id,
                    r.name as role_name, r.level as role_level,
                    sp.first_name, sp.last_name, sp.employee_number, 
                    sp.job_title, sp.phone, sp.gender,
                    sup_sp.first_name as supervisor_first_name,
                    sup_sp.last_name as supervisor_last_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             LEFT JOIN users sup ON u.supervisor_id = sup.id
             LEFT JOIN staff_profiles sup_sp ON sup.id = sup_sp.user_id
             WHERE u.department_id = $1 AND u.deleted_at IS NULL
             ORDER BY r.level, sp.first_name`,
            [departmentId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get department members error:', error);
        res.status(500).json({ error: 'Failed to fetch department members' });
    }
};

module.exports = {
    getMyTeam,
    getDepartmentMembers
};
