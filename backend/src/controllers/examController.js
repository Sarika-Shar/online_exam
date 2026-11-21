const { Op } = require('sequelize');
const {
  sequelize,
  Exam,
  ExamQuestion,
  ExamAssignment,
  Question,
  QuestionOption,
  Subject,
  Class,
  Batch,
  Student,
  User,
  Institution
} = require('../models');
const { recordAuditLog } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/**
 * List all exams with filtering and student assignment counts
 */
const getExams = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const { class_id, subject_id, status, search } = req.query;

    const where = {};
    if (institutionId) where.institution_id = institutionId;
    if (class_id) where.class_id = class_id;
    if (subject_id) where.subject_id = subject_id;
    if (status && status !== 'all') where.status = status;
    if (search && search.trim()) {
      where.title = { [Op.like]: `%${search.trim()}%` };
    }

    const exams = await Exam.findAll({
      where,
      order: [['start_time', 'ASC']],
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
        { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
        { model: Batch, as: 'batch', attributes: ['id', 'name'] },
        {
          model: ExamAssignment,
          as: 'assignments',
          attributes: ['id', 'student_id', 'status']
        },
        {
          model: ExamQuestion,
          as: 'exam_question_links',
          attributes: ['id', 'question_id']
        }
      ]
    });

    const formatted = exams.map(exam => {
      const plain = exam.toJSON();
      return {
        ...plain,
        assigned_students_count: plain.assignments ? plain.assignments.length : 0,
        linked_questions_count: plain.exam_question_links ? plain.exam_question_links.length : 0
      };
    });

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed single exam with its questions and candidate roster
 */
const getExamById = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const { id } = req.params;

    const where = { id };
    if (institutionId) where.institution_id = institutionId;

    const exam = await Exam.findOne({
      where,
      include: [
        { model: Subject, as: 'subject' },
        { model: Class, as: 'class' },
        { model: Batch, as: 'batch' },
        {
          model: ExamQuestion,
          as: 'exam_question_links',
          include: [
            {
              model: Question,
              as: 'question',
              include: [{ model: QuestionOption, as: 'options', attributes: ['id', 'option_key', 'option_text', 'is_correct'] }]
            }
          ]
        },
        {
          model: ExamAssignment,
          as: 'assignments',
          include: [
            {
              model: Student,
              as: 'student',
              include: [{ model: User, as: 'user', attributes: ['name', 'email', 'username'] }]
            }
          ]
        }
      ]
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: exam
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Secure Server-side Random Question Selection (Fisher-Yates Shuffle)
 * @param {Array<number>} questionIds 
 * @param {number} count 
 * @returns {Array<number>}
 */
const secureRandomSample = (questionIds, count) => {
  const shuffled = [...questionIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Cryptographically secure or uniform random swap
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
};

/**
 * Create a new examination with Section 7 3-Mode Question Selection
 */
const createExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    let institutionId = req.targetInstitutionId || req.body.institution_id;
    const {
      title,
      description,
      instructions,
      subject_id,
      class_id,
      batch_id,
      exam_date,
      start_time,
      end_time,
      duration_minutes,
      total_questions,
      total_marks,
      marks_per_question,
      negative_marking,
      passing_percentage,
      selection_mode, // 'manual_fixed', 'random_fixed_pool', 'random_per_student'
      manual_question_ids // Array of IDs if manual_fixed
    } = req.body;

    // 1. Mandatory Fields Validation
    if (!title || !subject_id || !class_id || !exam_date || !start_time || !end_time) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Title, Subject, Class, Exam Date, Start Time, and End Time are required.'
      });
    }

    // Auto-resolve institution if missing (e.g. Super Admin acting globally)
    if (!institutionId && subject_id) {
      const parentSubject = await Subject.findByPk(parseInt(subject_id, 10), { transaction });
      if (parentSubject) {
        institutionId = parentSubject.institution_id;
      }
    }

    if (!institutionId) {
      const defaultInst = await Institution.findOne({ where: { is_active: true }, transaction });
      if (defaultInst) {
        institutionId = defaultInst.id;
      }
    }

    const qCount = parseInt(total_questions || 50, 10);
    const mode = ['manual_fixed', 'random_fixed_pool', 'random_per_student'].includes(selection_mode)
      ? selection_mode
      : 'manual_fixed';

    // 2. Question Pool Availability Check
    const poolFilter = {
      subject_id: parseInt(subject_id, 10),
      status: 'approved'
    };
    if (institutionId) {
      poolFilter.institution_id = institutionId;
    }

    const poolQuestions = await Question.findAll({
      where: poolFilter,
      attributes: ['id'],
      transaction
    });

    const poolQuestionIds = poolQuestions.map(q => q.id);

    if (poolQuestionIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'The selected subject does not have any approved questions in the Question Bank.'
      });
    }

    let finalQuestionIds = [];

    // 3. Execute Selection Mode Logic
    if (mode === 'manual_fixed') {
      if (!manual_question_ids || !Array.isArray(manual_question_ids) || manual_question_ids.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Option A (Manual Fixed) requires an array of selected question IDs.'
        });
      }
      finalQuestionIds = manual_question_ids;
    } else if (mode === 'random_fixed_pool') {
      // Secure server-side randomized selection
      const desiredCount = Math.min(qCount, poolQuestionIds.length);
      finalQuestionIds = secureRandomSample(poolQuestionIds, desiredCount);
      logger.info(`Mode B (Random Fixed Pool): Server selected ${finalQuestionIds.length} random questions from a pool of ${poolQuestionIds.length}.`);
    } else if (mode === 'random_per_student') {
      // For Option C, questions are generated independently per student attempt.
      // We verify that the question pool has at least the minimum questions required.
      if (poolQuestionIds.length < qCount) {
        logger.warn(`Mode C: Question pool (${poolQuestionIds.length}) is smaller than requested (${qCount}). All available pool questions will be randomized per student.`);
      }
      logger.info(`Mode C (Random Per Student): Question pool ready with ${poolQuestionIds.length} approved items.`);
    }

    // 4. Create the Exam Record
    const exam = await Exam.create({
      institution_id: institutionId,
      title: title.trim(),
      description: description?.trim() || null,
      instructions: instructions?.trim() || '1. Ensure stable internet.\n2. Server timer is enforced.\n3. Automatic submission on expiration.',
      subject_id: parseInt(subject_id, 10),
      class_id: parseInt(class_id, 10),
      batch_id: batch_id ? parseInt(batch_id, 10) : null,
      exam_date,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      duration_minutes: parseInt(duration_minutes || 60, 10),
      total_questions: mode === 'manual_fixed' ? finalQuestionIds.length : qCount,
      total_marks: parseFloat(total_marks || 100.0),
      marks_per_question: parseFloat(marks_per_question || 2.0),
      negative_marking: parseFloat(negative_marking || 0.0),
      passing_percentage: parseFloat(passing_percentage || 40.0),
      selection_mode: mode,
      status: 'scheduled',
      results_published: false,
      created_by: req.user.id
    }, { transaction });

    // 5. Link Fixed Questions for Option A and Option B
    if (finalQuestionIds.length > 0) {
      const examQuestionLinks = finalQuestionIds.map((qId, idx) => ({
        exam_id: exam.id,
        question_id: qId,
        question_order: idx + 1
      }));
      await ExamQuestion.bulkCreate(examQuestionLinks, { transaction });
    }

    // 6. Automatic Candidate Assignment based on Class and Batch
    const studentFilter = {
      institution_id: institutionId,
      class_id: parseInt(class_id, 10),
      is_active: true
    };
    if (batch_id) {
      studentFilter.batch_id = parseInt(batch_id, 10);
    }

    const eligibleStudents = await Student.findAll({
      where: studentFilter,
      attributes: ['id'],
      transaction
    });

    if (eligibleStudents.length > 0) {
      const assignments = eligibleStudents.map(s => ({
        exam_id: exam.id,
        student_id: s.id,
        status: 'assigned'
      }));
      await ExamAssignment.bulkCreate(assignments, { transaction });
      logger.info(`Assigned ${assignments.length} candidates from Class ${class_id} to Exam ${exam.id}`);
    }

    await transaction.commit();

    await recordAuditLog({
      req,
      action: 'CREATE_EXAM',
      entity_type: 'Exam',
      entity_id: exam.id,
      details: {
        title: exam.title,
        selection_mode: mode,
        total_questions: exam.total_questions,
        assigned_candidates: eligibleStudents.length
      }
    });

    // Return created exam with relations
    const result = await Exam.findByPk(exam.id, {
      include: [
        { model: Subject, as: 'subject' },
        { model: Class, as: 'class' },
        { model: Batch, as: 'batch' }
      ]
    });

    return res.status(201).json({
      success: true,
      message: `Examination '${exam.title}' scheduled successfully with ${eligibleStudents.length} candidates assigned.`,
      data: result,
      assignedStudentsCount: eligibleStudents.length,
      linkedQuestionsCount: finalQuestionIds.length
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Update an existing examination
 */
const updateExam = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const { id } = req.params;

    const where = { id };
    if (institutionId) where.institution_id = institutionId;

    const exam = await Exam.findOne({ where });
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found.'
      });
    }

    if (exam.status === 'completed' || exam.status === 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot edit an examination that is currently ${exam.status}.`
      });
    }

    const {
      title,
      description,
      instructions,
      exam_date,
      start_time,
      end_time,
      duration_minutes,
      total_marks,
      marks_per_question,
      negative_marking,
      passing_percentage,
      status
    } = req.body;

    await exam.update({
      title: title ? title.trim() : exam.title,
      description: description !== undefined ? description : exam.description,
      instructions: instructions !== undefined ? instructions : exam.instructions,
      exam_date: exam_date || exam.exam_date,
      start_time: start_time ? new Date(start_time) : exam.start_time,
      end_time: end_time ? new Date(end_time) : exam.end_time,
      duration_minutes: duration_minutes ? parseInt(duration_minutes, 10) : exam.duration_minutes,
      total_marks: total_marks ? parseFloat(total_marks) : exam.total_marks,
      marks_per_question: marks_per_question ? parseFloat(marks_per_question) : exam.marks_per_question,
      negative_marking: negative_marking !== undefined ? parseFloat(negative_marking) : exam.negative_marking,
      passing_percentage: passing_percentage ? parseFloat(passing_percentage) : exam.passing_percentage,
      status: status || exam.status
    });

    await recordAuditLog({
      req,
      action: 'UPDATE_EXAM',
      entity_type: 'Exam',
      entity_id: exam.id,
      details: { title: exam.title, status: exam.status }
    });

    return res.status(200).json({
      success: true,
      message: 'Examination updated successfully.',
      data: exam
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change examination status (e.g. active, completed, cancelled)
 */
const updateExamStatus = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'scheduled', 'active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid examination status.'
      });
    }

    const where = { id };
    if (institutionId) where.institution_id = institutionId;

    const exam = await Exam.findOne({ where });
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found.'
      });
    }

    await exam.update({ status });

    await recordAuditLog({
      req,
      action: 'CHANGE_EXAM_STATUS',
      entity_type: 'Exam',
      entity_id: exam.id,
      details: { from: exam.status, to: status }
    });

    return res.status(200).json({
      success: true,
      message: `Examination status changed to '${status}'.`,
      data: exam
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete examination
 */
const deleteExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.targetInstitutionId;
    const { id } = req.params;

    const where = { id };
    if (institutionId) where.institution_id = institutionId;

    const exam = await Exam.findOne({ where, transaction });
    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Exam not found.'
      });
    }

    if (exam.status === 'active') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot delete an ongoing active examination.'
      });
    }

    await ExamQuestion.destroy({ where: { exam_id: id }, transaction });
    await ExamAssignment.destroy({ where: { exam_id: id }, transaction });
    await exam.destroy({ transaction });

    await transaction.commit();

    await recordAuditLog({
      req,
      action: 'DELETE_EXAM',
      entity_type: 'Exam',
      entity_id: id,
      details: { title: exam.title }
    });

    return res.status(200).json({
      success: true,
      message: 'Examination and its question links removed successfully.'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  getExams,
  getExamById,
  createExam,
  updateExam,
  updateExamStatus,
  deleteExam
};
