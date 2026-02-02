const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await db.query(
            `SELECT u.id, u.email, u.password_hash, u.role_id, u.department_id, u.is_active,
                    r.name as role_name, r.level as role_level,
                    d.name as department_name,
                    sp.first_name, sp.last_name, sp.employee_number, sp.job_title
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             WHERE u.email = $1 AND u.deleted_at IS NULL`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is inactive. Please contact administrator.' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                role: user.role_name,
                roleLevel: user.role_level
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        await logAudit(user.id, 'LOGIN', 'User', user.id, { email }, req);

        delete user.password_hash;

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role_name,
                roleLevel: user.role_level,
                department: user.department_name,
                firstName: user.first_name,
                lastName: user.last_name,
                employeeNumber: user.employee_number,
                jobTitle: user.job_title
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, userId]
        );

        await logAudit(userId, 'CHANGE_PASSWORD', 'User', userId, {}, req);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(
            `SELECT u.id, u.email, u.role_id, u.department_id, u.supervisor_id, u.last_login,
                    r.name as role_name, r.level as role_level,
                    d.name as department_name,
                    sp.*, 
                    s.first_name as supervisor_first_name, 
                    s.last_name as supervisor_last_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             LEFT JOIN staff_profiles s ON u.supervisor_id = s.user_id
             WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

module.exports = {
    login,
    changePassword,
    getProfile
};
