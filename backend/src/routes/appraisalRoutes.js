const express = require('express');
const router = express.Router();
const appraisalController = require('../controllers/appraisalController');
const { authenticateToken, authorizeMinLevel } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

router.get('/criteria', authenticateToken, appraisalController.getAppraisalCriteria);
router.post('/', authenticateToken, authorizeMinLevel(5), auditMiddleware('CREATE_APPRAISAL', 'Appraisal'), appraisalController.createAppraisal);
router.get('/', authenticateToken, appraisalController.getAppraisals);
router.get('/:id', authenticateToken, appraisalController.getAppraisalById);
router.put('/:id', authenticateToken, authorizeMinLevel(5), auditMiddleware('UPDATE_APPRAISAL', 'Appraisal'), appraisalController.updateAppraisal);
router.delete('/:id', authenticateToken, authorizeMinLevel(4), appraisalController.deleteAppraisal);

module.exports = router;
