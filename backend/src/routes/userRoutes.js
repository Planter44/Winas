const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeMinLevel } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

router.get('/', authenticateToken, authorizeMinLevel(4), userController.getAllUsers);
router.get('/:id', authenticateToken, userController.getUserById);
router.post('/', authenticateToken, authorizeMinLevel(4), auditMiddleware('CREATE_USER', 'User'), userController.createUser);
router.put('/:id', authenticateToken, authorizeMinLevel(4), auditMiddleware('UPDATE_USER', 'User'), userController.updateUser);
router.delete('/:id', authenticateToken, authorizeMinLevel(1), auditMiddleware('DELETE_USER', 'User'), userController.deleteUser);
router.post('/:id/reset-password', authenticateToken, authorizeMinLevel(1), userController.resetPassword);

module.exports = router;
