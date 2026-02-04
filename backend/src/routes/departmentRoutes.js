const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticateToken, authorizeMinLevel } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

router.get('/', authenticateToken, departmentController.getAllDepartments);
router.get('/roles', authenticateToken, departmentController.getRoles);
router.get('/:id', authenticateToken, departmentController.getDepartmentById);
router.post('/', authenticateToken, authorizeMinLevel(2), auditMiddleware('CREATE_DEPARTMENT', 'Department'), departmentController.createDepartment);
router.put('/:id', authenticateToken, authorizeMinLevel(2), auditMiddleware('UPDATE_DEPARTMENT', 'Department'), departmentController.updateDepartment);
router.delete('/:id', authenticateToken, authorizeMinLevel(2), departmentController.deleteDepartment);

module.exports = router;
