const { Subject, Class, QuestionBank, Batch, Student, Exam, Question, Institution } = require('../models');
const { recordAuditLog } = require('../middleware/auditLogger');

/**
 * Get subjects for dropdowns & management
 */
const getSubjects = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const filter = institutionId ? { institution_id: institutionId } : {};

    if (req.query.class_id) {
      filter.class_id = req.query.class_id;
    }

    const subjects = await Subject.findAll({
      where: filter,
      include: [{ model: Class, as: 'class', attributes: ['id', 'name', 'code'] }],
      order: [['name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: subjects
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Subject
 */
const createSubject = async (req, res, next) => {
  try {
    const { name, code, class_id, description, institution_id } = req.body;
    let targetInstId = req.targetInstitutionId || req.user.institution_id || institution_id;

    if (!targetInstId && class_id) {
      const parentClass = await Class.findByPk(class_id);
      if (parentClass) targetInstId = parentClass.institution_id;
    }

    if (!targetInstId) {
      const defaultInst = await Institution.findOne({ where: { is_active: true } });
      if (defaultInst) targetInstId = defaultInst.id;
    }

    if (!targetInstId) {
      return res.status(400).json({ success: false, message: 'Institution ID must be specified.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Subject name is required.' });
    }

    const newSubject = await Subject.create({
      institution_id: targetInstId,
      class_id: class_id || null,
      name: name.trim(),
      code: code ? code.trim() : null,
      description: description ? description.trim() : null,
      is_active: true
    });

    await recordAuditLog({
      req,
      action: 'CREATE_SUBJECT',
      entity_type: 'Subject',
      entity_id: newSubject.id,
      details: { name: newSubject.name, code: newSubject.code }
    });

    return res.status(201).json({
      success: true,
      message: 'Subject created successfully.',
      data: newSubject
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Subject
 */
const updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, class_id, description, is_active } = req.body;

    const subject = await Subject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    if (req.user.role !== 'super_admin' && subject.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify subject of another institution.' });
    }

    if (name) subject.name = name.trim();
    if (code !== undefined) subject.code = code ? code.trim() : null;
    if (class_id !== undefined) subject.class_id = class_id || null;
    if (description !== undefined) subject.description = description ? description.trim() : null;
    if (is_active !== undefined) subject.is_active = is_active;

    await subject.save();

    await recordAuditLog({
      req,
      action: 'UPDATE_SUBJECT',
      entity_type: 'Subject',
      entity_id: subject.id,
      details: { name: subject.name, code: subject.code }
    });

    return res.status(200).json({
      success: true,
      message: 'Subject updated successfully.',
      data: subject
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Subject
 */
const deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    if (req.user.role !== 'super_admin' && subject.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot delete subject of another institution.' });
    }

    const questionCount = await Question.count({ where: { subject_id: id } });
    if (questionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete subject. It has ${questionCount} question(s) associated with it. Please deactivate it instead.`
      });
    }

    const qbCount = await QuestionBank.count({ where: { subject_id: id } });
    if (qbCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete subject. It has ${qbCount} question bank(s) associated with it. Please deactivate it instead.`
      });
    }

    await subject.destroy();

    await recordAuditLog({
      req,
      action: 'DELETE_SUBJECT',
      entity_type: 'Subject',
      entity_id: id,
      details: { name: subject.name, code: subject.code }
    });

    return res.status(200).json({
      success: true,
      message: 'Subject deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Subject Active Status
 */
const toggleSubjectStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    if (req.user.role !== 'super_admin' && subject.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    subject.is_active = !subject.is_active;
    await subject.save();

    return res.status(200).json({
      success: true,
      message: `Subject ${subject.is_active ? 'activated' : 'deactivated'} successfully.`,
      data: subject
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get classes for dropdowns & management
 */
const getClasses = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const filter = institutionId ? { institution_id: institutionId } : {};

    const classes = await Class.findAll({
      where: filter,
      include: [
        { model: Batch, as: 'batches', attributes: ['id', 'name', 'code', 'is_active', 'start_year', 'end_year'] },
        { model: Subject, as: 'subjects', attributes: ['id', 'name', 'code', 'is_active'] }
      ],
      order: [['name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: classes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Class
 */
const createClass = async (req, res, next) => {
  try {
    const { name, code, description, institution_id } = req.body;
    let targetInstId = req.targetInstitutionId || req.user.institution_id || institution_id;

    if (!targetInstId) {
      const defaultInst = await Institution.findOne({ where: { is_active: true } });
      if (defaultInst) targetInstId = defaultInst.id;
    }

    if (!targetInstId) {
      return res.status(400).json({ success: false, message: 'Institution ID must be specified.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Class/Course name is required.' });
    }

    const newClass = await Class.create({
      institution_id: targetInstId,
      name: name.trim(),
      code: code ? code.trim() : null,
      description: description ? description.trim() : null,
      is_active: true
    });

    await recordAuditLog({
      req,
      action: 'CREATE_CLASS',
      entity_type: 'Class',
      entity_id: newClass.id,
      details: { name: newClass.name, code: newClass.code }
    });

    return res.status(201).json({
      success: true,
      message: 'Class created successfully.',
      data: newClass
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Class
 */
const updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, is_active } = req.body;

    const cls = await Class.findByPk(id);
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    if (req.user.role !== 'super_admin' && cls.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify class of another institution.' });
    }

    if (name) cls.name = name.trim();
    if (code !== undefined) cls.code = code ? code.trim() : null;
    if (description !== undefined) cls.description = description ? description.trim() : null;
    if (is_active !== undefined) cls.is_active = is_active;

    await cls.save();

    await recordAuditLog({
      req,
      action: 'UPDATE_CLASS',
      entity_type: 'Class',
      entity_id: cls.id,
      details: { name: cls.name, code: cls.code }
    });

    return res.status(200).json({
      success: true,
      message: 'Class updated successfully.',
      data: cls
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Class
 */
const deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cls = await Class.findByPk(id);
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    if (req.user.role !== 'super_admin' && cls.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot delete class of another institution.' });
    }

    // Check relations
    const studentCount = await Student.count({ where: { class_id: id } });
    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete class. ${studentCount} student(s) are enrolled in it. Please deactivate the class instead.`
      });
    }

    const batchCount = await Batch.count({ where: { class_id: id } });
    if (batchCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete class. It has ${batchCount} batch(es) assigned. Please remove or reassign the batches first.`
      });
    }

    const examCount = await Exam.count({ where: { class_id: id } });
    if (examCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete class. It is linked to ${examCount} scheduled or past exam(s).`
      });
    }

    await cls.destroy();

    await recordAuditLog({
      req,
      action: 'DELETE_CLASS',
      entity_type: 'Class',
      entity_id: id,
      details: { name: cls.name, code: cls.code }
    });

    return res.status(200).json({
      success: true,
      message: 'Class deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Class Active Status
 */
const toggleClassStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cls = await Class.findByPk(id);
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    if (req.user.role !== 'super_admin' && cls.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    cls.is_active = !cls.is_active;
    await cls.save();

    return res.status(200).json({
      success: true,
      message: `Class ${cls.is_active ? 'activated' : 'deactivated'} successfully.`,
      data: cls
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get question banks
 */
const getQuestionBanks = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const filter = institutionId ? { institution_id: institutionId } : {};
    if (req.query.subject_id) {
      filter.subject_id = req.query.subject_id;
    }

    const banks = await QuestionBank.findAll({
      where: filter,
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name'] }],
      order: [['name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: banks
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get batches for dropdowns & management
 */
const getBatches = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const filter = institutionId ? { institution_id: institutionId } : {};
    if (req.query.class_id) {
      filter.class_id = req.query.class_id;
    }

    const batches = await Batch.findAll({
      where: filter,
      include: [{ model: Class, as: 'class', attributes: ['id', 'name', 'code'] }],
      order: [['name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: batches
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Batch
 */
const createBatch = async (req, res, next) => {
  try {
    const { class_id, name, code, start_year, end_year, institution_id } = req.body;
    let targetInstId = req.targetInstitutionId || req.user.institution_id || institution_id;

    if (!class_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Class and Batch name are required.' });
    }

    // Verify class belongs to institution
    const parentClass = await Class.findByPk(class_id);
    if (!parentClass) {
      return res.status(404).json({ success: false, message: 'Associated Class not found.' });
    }

    if (req.user.role !== 'super_admin' && parentClass.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Class belongs to another institution.' });
    }

    if (!targetInstId) {
      targetInstId = parentClass.institution_id;
    }

    const newBatch = await Batch.create({
      institution_id: targetInstId,
      class_id,
      name: name.trim(),
      code: code ? code.trim() : null,
      start_year: start_year ? parseInt(start_year, 10) : null,
      end_year: end_year ? parseInt(end_year, 10) : null,
      is_active: true
    });

    await recordAuditLog({
      req,
      action: 'CREATE_BATCH',
      entity_type: 'Batch',
      entity_id: newBatch.id,
      details: { name: newBatch.name, code: newBatch.code, class_id }
    });

    return res.status(201).json({
      success: true,
      message: 'Batch created successfully.',
      data: newBatch
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Batch
 */
const updateBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { class_id, name, code, start_year, end_year, is_active } = req.body;

    const batch = await Batch.findByPk(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found.' });
    }

    if (req.user.role !== 'super_admin' && batch.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot modify batch of another institution.' });
    }

    if (class_id) {
      const parentClass = await Class.findByPk(class_id);
      if (!parentClass) {
        return res.status(404).json({ success: false, message: 'Associated Class not found.' });
      }
      batch.class_id = class_id;
    }

    if (name) batch.name = name.trim();
    if (code !== undefined) batch.code = code ? code.trim() : null;
    if (start_year !== undefined) batch.start_year = start_year ? parseInt(start_year, 10) : null;
    if (end_year !== undefined) batch.end_year = end_year ? parseInt(end_year, 10) : null;
    if (is_active !== undefined) batch.is_active = is_active;

    await batch.save();

    await recordAuditLog({
      req,
      action: 'UPDATE_BATCH',
      entity_type: 'Batch',
      entity_id: batch.id,
      details: { name: batch.name, code: batch.code }
    });

    return res.status(200).json({
      success: true,
      message: 'Batch updated successfully.',
      data: batch
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Batch
 */
const deleteBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const batch = await Batch.findByPk(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found.' });
    }

    if (req.user.role !== 'super_admin' && batch.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot delete batch of another institution.' });
    }

    const studentCount = await Student.count({ where: { batch_id: id } });
    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete batch. ${studentCount} student(s) are assigned to this batch. Please deactivate it instead.`
      });
    }

    await batch.destroy();

    await recordAuditLog({
      req,
      action: 'DELETE_BATCH',
      entity_type: 'Batch',
      entity_id: id,
      details: { name: batch.name, code: batch.code }
    });

    return res.status(200).json({
      success: true,
      message: 'Batch deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Batch Active Status
 */
const toggleBatchStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const batch = await Batch.findByPk(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found.' });
    }

    if (req.user.role !== 'super_admin' && batch.institution_id !== req.user.institution_id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    batch.is_active = !batch.is_active;
    await batch.save();

    return res.status(200).json({
      success: true,
      message: `Batch ${batch.is_active ? 'activated' : 'deactivated'} successfully.`,
      data: batch
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  toggleSubjectStatus,

  getClasses,
  createClass,
  updateClass,
  deleteClass,
  toggleClassStatus,

  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  toggleBatchStatus,

  getQuestionBanks
};
