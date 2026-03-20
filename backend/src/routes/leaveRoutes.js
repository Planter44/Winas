const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticateToken, authorizeMinLevel, authorizeRoles } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const upload = require('../middleware/upload');

router.post('/', authenticateToken, upload.single('document'), leaveController.createLeaveRequest);
router.post('/upload-document', authenticateToken, upload.single('document'), leaveController.uploadLeaveDocument);
router.get('/', authenticateToken, leaveController.getLeaveRequests);
router.get('/balance/:userId?', authenticateToken, leaveController.getLeaveBalance);
router.get('/:id', authenticateToken, leaveController.getLeaveRequestById);
router.post('/:id/supervisor-action', authenticateToken, authorizeRoles('Supervisor', 'HOD'), leaveController.supervisorActionOnLeave);
router.post('/:id/hr-action', authenticateToken, authorizeRoles('HR', 'Super Admin'), leaveController.hrActionOnLeave);
router.post('/:id/ceo-action', authenticateToken, authorizeRoles('CEO', 'Super Admin'), leaveController.ceoActionOnLeave);
router.post('/:id/cancel', authenticateToken, leaveController.cancelLeave);
router.put('/:id', authenticateToken, leaveController.updateLeave);

router.get('/types/all', authenticateToken, leaveController.getLeaveTypes);
router.post('/types', authenticateToken, authorizeMinLevel(2), auditMiddleware('CREATE_LEAVE_TYPE', 'LeaveType'), leaveController.createLeaveType);
router.put('/types/:id', authenticateToken, authorizeMinLevel(2), auditMiddleware('UPDATE_LEAVE_TYPE', 'LeaveType'), leaveController.updateLeaveType);
router.delete('/types/:id', authenticateToken, authorizeMinLevel(1), leaveController.deleteLeaveType);

module.exports = router;
