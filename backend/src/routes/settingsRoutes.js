const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, authorizeMinLevel, authorizeRoles } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const logoUpload = require('../middleware/logoUpload');

router.get('/public', settingsController.getPublicSettings);
router.get('/', authenticateToken, settingsController.getAllSettings);
router.get('/:key', authenticateToken, settingsController.getSettingByKey);
router.post('/company-logo', authenticateToken, authorizeRoles('Super Admin'), logoUpload.single('logo'), settingsController.uploadCompanyLogo);
router.post('/', authenticateToken, authorizeMinLevel(2), auditMiddleware('CREATE_SETTING', 'SystemSettings'), settingsController.createSetting);
router.put('/bulk', authenticateToken, authorizeMinLevel(2), settingsController.bulkUpdateSettings);
router.put('/:key', authenticateToken, authorizeMinLevel(2), auditMiddleware('UPDATE_SETTING', 'SystemSettings'), settingsController.updateSetting);
router.delete('/:key', authenticateToken, authorizeMinLevel(1), settingsController.deleteSetting);

module.exports = router;
