const express = require('express');
const router = express.Router();
const controller = require('../controllers/performanceAppraisalController');
const { authenticateToken, authorizeMinLevel, authorizeRoles } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

// Get pillars with KRAs
router.get('/pillars', authenticateToken, controller.getPillarsWithKRAs);

// Get soft skills
router.get('/soft-skills', authenticateToken, controller.getSoftSkills);

// Get rating key
router.get('/rating-key', authenticateToken, controller.getRatingKey);

// CRUD for appraisals
router.post('/', authenticateToken, authorizeRoles('Supervisor', 'HOD', 'HR', 'CEO', 'Super Admin'), controller.createAppraisal);
router.get('/', authenticateToken, controller.getAppraisals);
router.get('/:id', authenticateToken, controller.getAppraisalById);
router.put('/:id', authenticateToken, authorizeRoles('Supervisor', 'HOD', 'HR', 'CEO', 'Super Admin'), controller.updateAppraisal);
router.delete('/:id', authenticateToken, authorizeRoles('HR', 'CEO', 'Super Admin'), controller.deleteAppraisal);

// KRA management (HR and above)
router.post('/kras', authenticateToken, authorizeMinLevel(4), controller.createKRA);
router.put('/kras/:id', authenticateToken, authorizeMinLevel(4), controller.updateKRA);
router.delete('/kras/:id', authenticateToken, authorizeMinLevel(4), controller.deleteKRA);

module.exports = router;
