const db = require('../database/db');

const getDashboardStats = async (req, res) => {
    try {
        const currentUser = req.user;
        const currentYear = new Date().getFullYear();

        let stats = {};

        const totalUsers = await db.query(
            'SELECT COUNT(*) as count FROM users WHERE is_active = true AND deleted_at IS NULL'
        );
        stats.totalUsers = parseInt(totalUsers.rows[0].count);

        const totalDepartments = await db.query(
            'SELECT COUNT(*) as count FROM departments WHERE is_active = true AND deleted_at IS NULL'
        );
        stats.totalDepartments = parseInt(totalDepartments.rows[0].count);

        if (currentUser.role_name === 'Staff') {
            const myLeaves = await db.query(
                `SELECT COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) as pending, 
                        COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) as approved,
                        COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0) as rejected
                 FROM leave_requests 
                 WHERE user_id = $1 AND EXTRACT(YEAR FROM created_at) = $2 AND deleted_at IS NULL`,
                [currentUser.id, currentYear]
            );
            stats.myLeaveStats = myLeaves.rows[0];

            const myAppraisals = await db.query(
                `SELECT COUNT(*) as count FROM appraisals 
                 WHERE user_id = $1 AND period_year = $2 AND deleted_at IS NULL`,
                [currentUser.id, currentYear]
            );
            stats.myAppraisalsCount = parseInt(myAppraisals.rows[0].count);

            try {
                const myPerformanceAppraisals = await db.query(
                    `SELECT COUNT(*) as count
                     FROM performance_appraisals
                     WHERE user_id = $1 AND period_year = $2 AND deleted_at IS NULL`,
                    [currentUser.id, currentYear]
                );
                stats.myPerformanceAppraisalsCount = parseInt(myPerformanceAppraisals.rows[0].count);
            } catch (e) {
                stats.myPerformanceAppraisalsCount = 0;
            }

        } else if (currentUser.role_name === 'Supervisor') {
            const pendingLeaves = await db.query(
                `SELECT COUNT(*) as count FROM leave_requests 
                 WHERE supervisor_id = $1 AND supervisor_status = 'Pending' AND deleted_at IS NULL`,
                [currentUser.id]
            );
            stats.pendingLeaveApprovals = parseInt(pendingLeaves.rows[0].count);

            const teamSize = await db.query(
                `SELECT COUNT(*) as count FROM users 
                 WHERE supervisor_id = $1 AND is_active = true AND deleted_at IS NULL`,
                [currentUser.id]
            );
            stats.teamSize = parseInt(teamSize.rows[0].count);

            const myAppraisals = await db.query(
                `SELECT COUNT(*) as count FROM appraisals 
                 WHERE user_id = $1 AND period_year = $2 AND deleted_at IS NULL`,
                [currentUser.id, currentYear]
            );
            stats.myAppraisalsCount = parseInt(myAppraisals.rows[0].count);

            try {
                const myPerformanceAppraisals = await db.query(
                    `SELECT COUNT(*) as count
                     FROM performance_appraisals
                     WHERE user_id = $1 AND period_year = $2 AND deleted_at IS NULL`,
                    [currentUser.id, currentYear]
                );
                stats.myPerformanceAppraisalsCount = parseInt(myPerformanceAppraisals.rows[0].count);
            } catch (e) {
                stats.myPerformanceAppraisalsCount = 0;
            }

        } else if (currentUser.role_name === 'HR') {
            const leaveStats = await db.query(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Pending' AND supervisor_status = 'Approved' THEN 1 ELSE 0 END) as pending_hr,
                    SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected
                 FROM leave_requests 
                 WHERE EXTRACT(YEAR FROM created_at) = $1 AND deleted_at IS NULL`,
                [currentYear]
            );
            stats.leaveStats = leaveStats.rows[0];

            const appraisalStats = await db.query(
                `SELECT COUNT(*) as total,
                        SUM(CASE WHEN status = 'Finalized' THEN 1 ELSE 0 END) as finalized
                 FROM appraisals WHERE period_year = $1 AND deleted_at IS NULL`,
                [currentYear]
            );
            stats.appraisalStats = appraisalStats.rows[0];

            try {
                const performanceAppraisalStats = await db.query(
                    `SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Finalized' THEN 1 ELSE 0 END) as finalized,
                        SUM(CASE WHEN status IN ('Draft', 'Submitted', 'Supervisor_Review', 'HOD_Review', 'HR_Review', 'CEO_Approved') THEN 1 ELSE 0 END) as pending_review,
                        AVG(NULLIF(total_performance_rating, 0)) as average_rating
                     FROM performance_appraisals
                     WHERE period_year = $1 AND deleted_at IS NULL`,
                    [currentYear]
                );
                stats.performanceAppraisalStats = performanceAppraisalStats.rows[0];
            } catch (e) {
                stats.performanceAppraisalStats = { total: 0, finalized: 0, pending_review: 0, average_rating: null };
            }

        } else if (currentUser.role_name === 'HOD') {
            const deptStats = await db.query(
                `SELECT COUNT(*) as staff_count FROM users 
                 WHERE department_id = $1 AND is_active = true AND deleted_at IS NULL`,
                [currentUser.department_id]
            );
            stats.departmentStaffCount = parseInt(deptStats.rows[0].staff_count);

            const deptLeaves = await db.query(
                `SELECT COUNT(*) as count FROM leave_requests lr
                 JOIN users u ON lr.user_id = u.id
                 WHERE u.department_id = $1 AND lr.status = 'Pending' AND lr.deleted_at IS NULL`,
                [currentUser.department_id]
            );
            stats.departmentPendingLeaves = parseInt(deptLeaves.rows[0].count);

            const myAppraisals = await db.query(
                `SELECT COUNT(*) as count FROM appraisals 
                 WHERE user_id = $1 AND period_year = $2 AND deleted_at IS NULL`,
                [currentUser.id, currentYear]
            );
            stats.myAppraisalsCount = parseInt(myAppraisals.rows[0].count);

            try {
                const myPerformanceAppraisals = await db.query(
                    `SELECT COUNT(*) as count
                     FROM performance_appraisals
                     WHERE user_id = $1 AND period_year = $2 AND deleted_at IS NULL`,
                    [currentUser.id, currentYear]
                );
                stats.myPerformanceAppraisalsCount = parseInt(myPerformanceAppraisals.rows[0].count);
            } catch (e) {
                stats.myPerformanceAppraisalsCount = 0;
            }

        } else if (currentUser.role_name === 'CEO' || currentUser.role_name === 'Super Admin') {
            const leaveStats = await db.query(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected
                 FROM leave_requests 
                 WHERE EXTRACT(YEAR FROM created_at) = $1 AND deleted_at IS NULL`,
                [currentYear]
            );
            stats.leaveStats = leaveStats.rows[0];

            const appraisalStats = await db.query(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Finalized' THEN 1 ELSE 0 END) as finalized,
                    AVG(overall_score) as average_score
                 FROM appraisals 
                 WHERE period_year = $1 AND deleted_at IS NULL`,
                [currentYear]
            );
            stats.appraisalStats = appraisalStats.rows[0];

            try {
                const performanceAppraisalStats = await db.query(
                    `SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Finalized' THEN 1 ELSE 0 END) as finalized,
                        SUM(CASE WHEN status IN ('Draft', 'Submitted', 'Supervisor_Review', 'HOD_Review', 'HR_Review', 'CEO_Approved') THEN 1 ELSE 0 END) as pending_review,
                        AVG(NULLIF(total_performance_rating, 0)) as average_rating
                     FROM performance_appraisals
                     WHERE period_year = $1 AND deleted_at IS NULL`,
                    [currentYear]
                );
                stats.performanceAppraisalStats = performanceAppraisalStats.rows[0];
            } catch (e) {
                stats.performanceAppraisalStats = { total: 0, finalized: 0, pending_review: 0, average_rating: null };
            }

            const departmentBreakdown = await db.query(
                `SELECT d.name, COUNT(u.id) as staff_count
                 FROM departments d
                 LEFT JOIN users u ON d.id = u.department_id AND u.is_active = true AND u.deleted_at IS NULL
                 WHERE d.is_active = true AND d.deleted_at IS NULL
                 GROUP BY d.id, d.name
                 ORDER BY staff_count DESC`
            );
            stats.departmentBreakdown = departmentBreakdown.rows;
        }

        res.json(stats);
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
};

const getLeaveAnalytics = async (req, res) => {
    try {
        const { year, departmentId } = req.query;
        const targetYear = year || new Date().getFullYear();

        let departmentFilter = '';
        const params = [targetYear];
        
        if (departmentId) {
            departmentFilter = ' AND u.department_id = $2';
            params.push(departmentId);
        }

        const monthlyLeaves = await db.query(
            `SELECT 
                EXTRACT(MONTH FROM lr.start_date) as month,
                COUNT(*) as total,
                SUM(CASE WHEN lr.status = 'Approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN lr.status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN lr.status = 'Pending' THEN 1 ELSE 0 END) as pending
             FROM leave_requests lr
             JOIN users u ON lr.user_id = u.id
             WHERE EXTRACT(YEAR FROM lr.start_date) = $1 AND lr.deleted_at IS NULL${departmentFilter}
             GROUP BY EXTRACT(MONTH FROM lr.start_date)
             ORDER BY month`,
            params
        );

        const leaveTypeStats = await db.query(
            `SELECT 
                lt.name as leave_type,
                COUNT(*) as count,
                SUM(lr.days_requested) as total_days
             FROM leave_requests lr
             JOIN leave_types lt ON lr.leave_type_id = lt.id
             JOIN users u ON lr.user_id = u.id
             WHERE EXTRACT(YEAR FROM lr.start_date) = $1 
                   AND lr.status = 'Approved' AND lr.deleted_at IS NULL${departmentFilter}
             GROUP BY lt.id, lt.name
             ORDER BY count DESC`,
            params
        );

        res.json({
            monthlyLeaves: monthlyLeaves.rows,
            leaveTypeStats: leaveTypeStats.rows
        });
    } catch (error) {
        console.error('Get leave analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch leave analytics' });
    }
};

const getAppraisalAnalytics = async (req, res) => {
    try {
        const { year, departmentId } = req.query;
        const targetYear = year || new Date().getFullYear();

        let departmentFilter = '';
        const params = [targetYear];
        
        if (departmentId) {
            departmentFilter = ' AND u.department_id = $2';
            params.push(departmentId);
        }

        const performanceTrend = await db.query(
            `SELECT 
                a.period_quarter,
                COUNT(*) as total_appraisals,
                AVG(a.overall_score) as average_score,
                MIN(a.overall_score) as min_score,
                MAX(a.overall_score) as max_score
             FROM appraisals a
             JOIN users u ON a.user_id = u.id
             WHERE a.period_year = $1 AND a.status = 'Finalized' 
                   AND a.deleted_at IS NULL${departmentFilter}
             GROUP BY a.period_quarter
             ORDER BY a.period_quarter`,
            params
        );

        const criteriaAverages = await db.query(
            `SELECT 
                aps.criteria,
                AVG(aps.score) as average_score,
                COUNT(*) as count
             FROM appraisal_scores aps
             JOIN appraisals a ON aps.appraisal_id = a.id
             JOIN users u ON a.user_id = u.id
             WHERE a.period_year = $1 AND a.status = 'Finalized' 
                   AND a.deleted_at IS NULL${departmentFilter}
             GROUP BY aps.criteria
             ORDER BY average_score DESC`,
            params
        );

        res.json({
            performanceTrend: performanceTrend.rows,
            criteriaAverages: criteriaAverages.rows
        });
    } catch (error) {
        console.error('Get appraisal analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch appraisal analytics' });
    }
};

const getAuditLogs = async (req, res) => {
    try {
        const { limit = 50, offset = 0, action, entityType, userId } = req.query;

        let query = `
            SELECT al.*, u.email as user_email,
                   sp.first_name, sp.last_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN staff_profiles sp ON u.id = sp.user_id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (action) {
            query += ` AND al.action = $${paramCount}`;
            params.push(action);
            paramCount++;
        }

        if (entityType) {
            query += ` AND al.entity_type = $${paramCount}`;
            params.push(entityType);
            paramCount++;
        }

        if (userId) {
            query += ` AND al.user_id = $${paramCount}`;
            params.push(userId);
            paramCount++;
        }

        query += ` ORDER BY al.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};

module.exports = {
    getDashboardStats,
    getLeaveAnalytics,
    getAppraisalAnalytics,
    getAuditLogs
};
