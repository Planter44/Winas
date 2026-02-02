const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, authorizeMinLevel } = require('../middleware/auth');

router.get('/stats', authenticateToken, dashboardController.getDashboardStats);
router.get('/analytics/leave', authenticateToken, authorizeMinLevel(3), dashboardController.getLeaveAnalytics);
router.get('/analytics/appraisal', authenticateToken, authorizeMinLevel(3), dashboardController.getAppraisalAnalytics);
router.get('/audit-logs', authenticateToken, authorizeMinLevel(1), dashboardController.getAuditLogs);

module.exports = router;
