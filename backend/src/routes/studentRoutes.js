const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const uploadExcel = require('../middleware/excelUpload');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Admin and Teacher roles
router.use(authenticate);
router.use(authorize('super_admin', 'institution_admin', 'teacher'));
router.use(requireInstitution);

router.get('/', studentController.getStudents);
router.post('/', studentController.createStudent);
// Bulk import supporting both multipart Excel/CSV file upload AND raw JSON payload
router.post('/bulk-import', uploadExcel.single('file'), studentController.bulkImportStudents);
router.get('/import-template', studentController.downloadImportTemplate);
router.put('/:id/toggle-status', studentController.toggleStudentStatus);
router.get('/export', studentController.exportStudentsCsv);

module.exports = router;
