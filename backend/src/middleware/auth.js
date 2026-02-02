const jwt = require('jsonwebtoken');
const db = require('../database/db');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const result = await db.query(
            `SELECT u.id, u.email, u.role_id, u.department_id, u.supervisor_id, u.is_active,
                    r.name as role_name, r.level as role_level,
                    d.name as department_name,
                    sp.first_name, sp.last_name, sp.employee_number, sp.job_title
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'User not found or inactive' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Token expired' });
        }
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role_name)) {
            return res.status(403).json({ 
                error: 'Access denied. Insufficient permissions.' 
            });
        }

        next();
    };
};

const authorizeMinLevel = (minLevel) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (req.user.role_level > minLevel) {
            return res.status(403).json({ 
                error: 'Access denied. Insufficient permissions.' 
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    authorizeRoles,
    authorizeMinLevel
};
