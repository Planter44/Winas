const db = require('../database/db');

const logAudit = async (userId, action, entityType, entityId, details = {}, req = null) => {
    try {
        const ipAddress = req ? (req.ip || req.connection.remoteAddress) : null;
        const userAgent = req ? req.get('user-agent') : null;

        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, action, entityType, entityId, JSON.stringify(details), ipAddress, userAgent]
        );
    } catch (error) {
        console.error('Audit log error:', error);
    }
};

const auditMiddleware = (action, entityType) => {
    return async (req, res, next) => {
        const originalJson = res.json.bind(res);
        
        res.json = function(data) {
            if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
                const entityId = data.id || data.data?.id || req.params.id || null;
                logAudit(req.user.id, action, entityType, entityId, { 
                    method: req.method, 
                    path: req.path,
                    body: req.body 
                }, req);
            }
            return originalJson(data);
        };
        
        next();
    };
};

module.exports = {
    logAudit,
    auditMiddleware
};
