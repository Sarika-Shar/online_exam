const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const { User, Student, Class, Batch, Institution, sequelize } = require('../models');
const { recordAuditLog } = require('../middleware/auditLogger');
const { sendStudentCredentialsEmail, sendBulkCredentialsEmails } = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Get paginated, searchable, and filtered students list
 */
const getStudents = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const {
      page = 1,
      limit = 20,
      search = '',
      class_id,
      batch_id,
      status // 'active', 'inactive', 'all'
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const whereClause = { institution_id: institutionId };

    if (class_id) whereClause.class_id = class_id;
    if (batch_id) whereClause.batch_id = batch_id;
    if (status && status !== 'all') {
      whereClause.is_active = status === 'active';
    }

    const userWhereClause = {};
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { student_id: { [Op.like]: term } },
        { roll_no: { [Op.like]: term } },
        { enrollment_no: { [Op.like]: term } },
        { '$user.name$': { [Op.like]: term } },
        { '$user.email$': { [Op.like]: term } }
      ];
    }

    const { count, rows: students } = await Student.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'username', 'phone', 'is_active', 'last_login_at'],
          where: userWhereClause
        },
        {
          model: Class,
          as: 'class',
          attributes: ['id', 'name']
        },
        {
          model: Batch,
          as: 'batch',
          attributes: ['id', 'name', 'start_year', 'end_year']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset
    });

    return res.status(200).json({
      success: true,
      data: {
        students,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(count / parseInt(limit, 10))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a single student (User + Student Profile)
 */
const createStudent = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.institutionId;
    const {
      name,
      email,
      username,
      password,
      class_id,
      batch_id,
      roll_no,
      enrollment_no,
      gender,
      date_of_birth,
      parent_name,
      parent_phone
    } = req.body;

    if (!name || !email || !class_id || !batch_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Name, email, class, and batch are required.'
      });
    }

    // Check existing email/username
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase().trim() },
          username ? { username: username.trim() } : { email: email.toLowerCase().trim() }
        ]
      },
      transaction
    });

    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists.'
      });
    }

    // Auto-generate student_id if not supplied
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const student_id = req.body.student_id || `STU-${year}-${randomSuffix}`;
    const generatedUsername = username || email.split('@')[0];
    const passwordHash = await bcrypt.hash(password || 'Student@123', 10);

    // 1. Create User
    const user = await User.create({
      institution_id: institutionId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      username: generatedUsername,
      password_hash: passwordHash,
      role: 'student',
      is_active: true
    }, { transaction });

    // 2. Create Student Profile
    const student = await Student.create({
      institution_id: institutionId,
      user_id: user.id,
      class_id: parseInt(class_id, 10),
      batch_id: parseInt(batch_id, 10),
      student_id,
      roll_no: roll_no || `ROLL-${randomSuffix}`,
      enrollment_no: enrollment_no || null,
      gender: gender || null,
      date_of_birth: date_of_birth || null,
      parent_name: parent_name || null,
      parent_phone: parent_phone || null,
      is_active: true
    }, { transaction });

    await transaction.commit();

    // Asynchronously dispatch welcome credentials email to the new student
    sendStudentCredentialsEmail({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      username: generatedUsername,
      password: password || 'Student@123',
      studentId: student_id
    }).catch(e => logger.warn(`Student credential email dispatch notice: ${e.message}`));

    await recordAuditLog({
      req,
      action: 'CREATE_STUDENT',
      entity_type: 'Student',
      entity_id: student.id,
      details: { student_id, email, name, class_id, batch_id }
    });

    return res.status(201).json({
      success: true,
      message: 'Student account registered successfully.',
      data: {
        id: student.id,
        student_id: student.student_id,
        name: user.name,
        email: user.email,
        roll_no: student.roll_no
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Bulk import students from Excel file (.xlsx, .xls, .csv) or JSON array
 */
const bulkImportStudents = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.institutionId;
    let studentsToProcess = [];

    // 1. Check if an Excel or CSV file was uploaded via Multer
    if (req.file) {
      try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Uploaded spreadsheet contains no readable sheets.'
          });
        }
        const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        // Normalize Excel column headers (e.g. "Full Name" -> name, "Roll Number" -> roll_no)
        studentsToProcess = rawRows.map(row => {
          const normalized = {};
          for (const [key, val] of Object.entries(row)) {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
            normalized[cleanKey] = typeof val === 'string' ? val.trim() : val;
          }
          return {
            name: normalized.name || normalized.full_name || normalized.student_name || '',
            email: normalized.email || normalized.student_email || normalized.email_address || '',
            roll_no: normalized.roll_no || normalized.roll_number || normalized.roll || '',
            class_ident: normalized.class || normalized.class_name || normalized.class_id || '',
            batch_ident: normalized.batch || normalized.batch_name || normalized.batch_id || '',
            student_id: normalized.student_id || normalized.id || '',
            enrollment_no: normalized.enrollment_no || normalized.enrollment || '',
            gender: (normalized.gender || '').toLowerCase(),
            parent_phone: normalized.phone || normalized.phone_number || normalized.parent_phone || normalized.mobile || '',
            parent_name: normalized.parent_name || normalized.guardian || '',
            password: normalized.password || ''
          };
        });
      } catch (parseError) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Failed to read Excel workbook: ' + parseError.message
        });
      }
    } else if (Array.isArray(req.body.students)) {
      studentsToProcess = req.body.students;
    } else if (typeof req.body.students === 'string') {
      try {
        studentsToProcess = JSON.parse(req.body.students);
      } catch {
        studentsToProcess = [];
      }
    }

    if (!Array.isArray(studentsToProcess) || studentsToProcess.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No student records detected. Please upload an Excel/CSV file or pass student rows.'
      });
    }

    const { default_class_id, default_batch_id, default_password } = req.body;

    // 2. Pre-fetch existing Classes and Batches to allow matching by Name, Code, or ID
    const existingClasses = await Class.findAll({
      where: { institution_id: institutionId },
      transaction
    });
    const existingBatches = await Batch.findAll({
      where: { institution_id: institutionId },
      transaction
    });

    const classLookup = new Map();
    existingClasses.forEach(c => {
      classLookup.set(String(c.id), c.id);
      classLookup.set(c.name.toLowerCase().trim(), c.id);
      if (c.code) classLookup.set(c.code.toLowerCase().trim(), c.id);
    });

    const batchLookup = new Map();
    existingBatches.forEach(b => {
      batchLookup.set(String(b.id), b.id);
      batchLookup.set(b.name.toLowerCase().trim(), b.id);
      if (b.code) batchLookup.set(b.code.toLowerCase().trim(), b.id);
    });

    const defaultPwHash = await bcrypt.hash(default_password || 'Student@123', 8);
    const imported = [];
    const skipped = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 0; i < studentsToProcess.length; i++) {
      const row = studentsToProcess[i];
      const email = (row.email || '').toLowerCase().trim();
      const name = (row.name || '').trim();

      // Resolve Class ID
      const rawClass = String(row.class_ident || row.class_id || default_class_id || '').toLowerCase().trim();
      const resolvedClassId = classLookup.get(rawClass) || (default_class_id ? parseInt(default_class_id, 10) : existingClasses[0]?.id);

      // Resolve Batch ID
      const rawBatch = String(row.batch_ident || row.batch_id || default_batch_id || '').toLowerCase().trim();
      const resolvedBatchId = batchLookup.get(rawBatch) || (default_batch_id ? parseInt(default_batch_id, 10) : existingBatches[0]?.id);

      // Validation
      if (!name) {
        skipped.push({ row: i + 1, email: email || 'N/A', reason: 'Student name is missing' });
        continue;
      }

      if (!email || !emailRegex.test(email)) {
        skipped.push({ row: i + 1, email: email || 'N/A', reason: 'Invalid or missing email address' });
        continue;
      }

      if (!resolvedClassId || !resolvedBatchId) {
        skipped.push({ row: i + 1, email, reason: 'Class or Batch could not be resolved' });
        continue;
      }

      // Check if user with this email already exists
      const existingUser = await User.findOne({ where: { email }, transaction });
      if (existingUser) {
        skipped.push({ row: i + 1, email, reason: 'Email is already registered in the system' });
        continue;
      }

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const studentId = row.student_id || `STU-${new Date().getFullYear()}-${randomSuffix}`;
      const username = row.username || email.split('@')[0] + '_' + randomSuffix;

      // Custom password or fallback
      const passwordHash = row.password
        ? await bcrypt.hash(String(row.password), 8)
        : defaultPwHash;

      // Create User credential record
      const user = await User.create({
        institution_id: institutionId,
        name,
        email,
        username,
        password_hash: passwordHash,
        role: 'student',
        phone: row.parent_phone || null,
        is_active: true
      }, { transaction });

      // Create Student profile record
      const student = await Student.create({
        institution_id: institutionId,
        user_id: user.id,
        class_id: resolvedClassId,
        batch_id: resolvedBatchId,
        student_id: studentId,
        roll_no: row.roll_no || `ROLL-${randomSuffix}`,
        enrollment_no: row.enrollment_no || null,
        gender: ['male', 'female', 'other'].includes(row.gender) ? row.gender : null,
        parent_name: row.parent_name || null,
        parent_phone: row.parent_phone || null,
        is_active: true
      }, { transaction });

      imported.push({
        id: student.id,
        name,
        email,
        username,
        password: row.password || default_password || 'Student@123',
        student_id: studentId,
        roll_no: student.roll_no,
        class_id: resolvedClassId,
        batch_id: resolvedBatchId
      });
    }

    await transaction.commit();

    // Asynchronously dispatch welcome credentials email to all imported students in batches
    sendBulkCredentialsEmails(imported).catch(e => logger.warn(`Bulk student email dispatch notice: ${e.message}`));

    await recordAuditLog({
      req,
      action: 'BULK_IMPORT_STUDENTS',
      entity_type: 'Student',
      entity_id: null,
      details: {
        source: req.file ? 'EXCEL_FILE' : 'JSON_PAYLOAD',
        totalProcessed: studentsToProcess.length,
        importedCount: imported.length,
        skippedCount: skipped.length
      }
    });

    return res.status(200).json({
      success: true,
      message: `Bulk import completed: ${imported.length} student(s) successfully registered, ${skipped.length} skipped.`,
      data: {
        totalRows: studentsToProcess.length,
        importedCount: imported.length,
        skippedCount: skipped.length,
        imported,
        skipped
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Generate & download sample Excel template for bulk student import
 */
const downloadImportTemplate = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const existingClasses = await Class.findAll({
      where: { institution_id: institutionId },
      attributes: ['name']
    });
    const existingBatches = await Batch.findAll({
      where: { institution_id: institutionId },
      attributes: ['name']
    });

    const sampleClassName = existingClasses[0]?.name || 'Computer Science';
    const sampleBatchName = existingBatches[0]?.name || 'Batch 2026-A';

    const sampleData = [
      {
        'Full Name': 'Aarav Sharma',
        'Email Address': 'aarav.sharma@apex.edu',
        'Roll Number': 'ROLL-2026-101',
        'Class': sampleClassName,
        'Batch': sampleBatchName,
        'Gender': 'male',
        'Phone Number': '+91-9876543210',
        'Password': 'Student@123'
      },
      {
        'Full Name': 'Priya Patel',
        'Email Address': 'priya.patel@apex.edu',
        'Roll Number': 'ROLL-2026-102',
        'Class': sampleClassName,
        'Batch': sampleBatchName,
        'Gender': 'female',
        'Phone Number': '+91-9876543211',
        'Password': 'Student@123'
      },
      {
        'Full Name': 'Rohan Gupta',
        'Email Address': 'rohan.gupta@apex.edu',
        'Roll Number': 'ROLL-2026-103',
        'Class': sampleClassName,
        'Batch': sampleBatchName,
        'Gender': 'male',
        'Phone Number': '+91-9876543212',
        'Password': 'Student@123'
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);

    // Format column widths for great readability
    worksheet['!cols'] = [
      { wch: 22 }, // Full Name
      { wch: 30 }, // Email Address
      { wch: 18 }, // Roll Number
      { wch: 22 }, // Class
      { wch: 18 }, // Batch
      { wch: 12 }, // Gender
      { wch: 18 }, // Phone Number
      { wch: 16 }  // Password
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Students_Roster');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="student_bulk_import_template.xlsx"');
    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Student active/inactive status
 */
const toggleStudentStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.institutionId;
    const { id } = req.params;

    const student = await Student.findOne({
      where: { id, institution_id: institutionId },
      include: [{ model: User, as: 'user' }],
      transaction
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const nextStatus = !student.is_active;
    student.is_active = nextStatus;
    await student.save({ transaction });

    if (student.user) {
      student.user.is_active = nextStatus;
      await student.user.save({ transaction });
    }

    await transaction.commit();

    await recordAuditLog({
      req,
      action: nextStatus ? 'ACTIVATE_STUDENT' : 'DEACTIVATE_STUDENT',
      entity_type: 'Student',
      entity_id: student.id,
      details: { student_id: student.student_id, is_active: nextStatus }
    });

    return res.status(200).json({
      success: true,
      message: `Student account ${nextStatus ? 'activated' : 'deactivated'} successfully.`,
      data: { id: student.id, is_active: student.is_active }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Export student directory to CSV format
 */
const exportStudentsCsv = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { class_id, batch_id } = req.query;

    const whereClause = { institution_id: institutionId };
    if (class_id) whereClause.class_id = class_id;
    if (batch_id) whereClause.batch_id = batch_id;

    const students = await Student.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['name', 'email', 'phone', 'is_active'] },
        { model: Class, as: 'class', attributes: ['name'] },
        { model: Batch, as: 'batch', attributes: ['name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const headers = ['Student ID', 'Roll No', 'Full Name', 'Email', 'Class', 'Batch', 'Phone', 'Status'];
    const rows = students.map(s => [
      `"${s.student_id}"`,
      `"${s.roll_no || ''}"`,
      `"${(s.user?.name || '').replace(/"/g, '""')}"`,
      `"${s.user?.email || ''}"`,
      `"${s.class?.name || ''}"`,
      `"${s.batch?.name || ''}"`,
      `"${s.user?.phone || ''}"`,
      `"${s.is_active ? 'Active' : 'Inactive'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="students_roster_${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  createStudent,
  bulkImportStudents,
  downloadImportTemplate,
  toggleStudentStatus,
  exportStudentsCsv
};
