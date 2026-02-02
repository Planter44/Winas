const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, authorizeMinLevel } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

router.get('/', authenticateToken, settingsController.getAllSettings);
router.get('/:key', authenticateToken, settingsController.getSettingByKey);
router.post('/', authenticateToken, authorizeMinLevel(2), auditMiddleware('CREATE_SETTING', 'SystemSettings'), settingsController.createSetting);
router.put('/bulk', authenticateToken, authorizeMinLevel(2), settingsController.bulkUpdateSettings);
router.put('/:key', authenticateToken, authorizeMinLevel(2), auditMiddleware('UPDATE_SETTING', 'SystemSettings'), settingsController.updateSetting);
router.delete('/:key', authenticateToken, authorizeMinLevel(1), settingsController.deleteSetting);

module.exports = router;
