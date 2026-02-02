const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken, authorizeMinLevel } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeMinLevel(5), messageController.sendMessage);
router.get('/inbox', authenticateToken, messageController.getInbox);
router.get('/unread-count', authenticateToken, messageController.getUnreadCount);
router.get('/:id', authenticateToken, messageController.getMessageById);
router.patch('/:id/read', authenticateToken, messageController.markAsRead);
router.delete('/:id', authenticateToken, messageController.deleteMessage);

module.exports = router;
