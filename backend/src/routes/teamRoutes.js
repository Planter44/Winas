const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticateToken, authorizeMinLevel } = require('../middleware/auth');

router.get('/my-team', authenticateToken, authorizeMinLevel(5), teamController.getMyTeam);
router.get('/department/:departmentId/members', authenticateToken, authorizeMinLevel(4), teamController.getDepartmentMembers);

module.exports = router;
