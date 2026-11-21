const { Op } = require('sequelize');
const { sequelize, Question, QuestionOption, Subject, QuestionBank, ExamQuestion, Institution } = require('../models');
const { recordAuditLog } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/**
 * Get paginated and filtered list of questions
 */
const getQuestions = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const {
      subject_id,
      question_bank_id,
      topic,
      difficulty_level,
      language,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const where = {};
    if (institutionId) {
      where.institution_id = institutionId;
    }

    if (subject_id) {
      where.subject_id = parseInt(subject_id, 10);
    }

    if (question_bank_id) {
      where.question_bank_id = parseInt(question_bank_id, 10);
    }

    if (topic && topic !== 'all') {
      where.topic = topic;
    }

    if (difficulty_level && difficulty_level !== 'all') {
      where.difficulty_level = difficulty_level;
    }

    if (language && language !== 'all') {
      where.language = language;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { question_text: { [Op.like]: term } },
        { topic: { [Op.like]: term } }
      ];
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const { count, rows } = await Question.findAndCountAll({
      where,
      distinct: true,
      limit: parsedLimit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: QuestionOption,
          as: 'options',
          attributes: ['id', 'option_key', 'option_text', 'is_correct']
        },
        {
          model: Subject,
          as: 'subject',
          attributes: ['id', 'name', 'code']
        },
        {
          model: QuestionBank,
          as: 'question_bank',
          attributes: ['id', 'name']
        }
      ]
    });

    return res.status(200).json({
      success: true,
      data: {
        total: count,
        page: parseInt(page, 10),
        totalPages: Math.ceil(count / parsedLimit),
        questions: rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get distinct topics for a subject
 */
const getTopicsBySubject = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const { subject_id } = req.query;

    const where = {};
    if (institutionId) where.institution_id = institutionId;
    if (subject_id) where.subject_id = subject_id;

    const questions = await Question.findAll({
      where,
      attributes: ['topic'],
      group: ['topic']
    });

    const topics = questions
      .map(q => q.topic)
      .filter(t => t && t.trim().length > 0);

    return res.status(200).json({
      success: true,
      data: topics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get statistics of questions in the question bank
 */
const getQuestionStats = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const { subject_id } = req.query;

    const filter = {};
    if (institutionId) filter.institution_id = institutionId;
    if (subject_id) filter.subject_id = subject_id;

    const [total, easyCount, mediumCount, hardCount] = await Promise.all([
      Question.count({ where: filter }),
      Question.count({ where: { ...filter, difficulty_level: 'easy' } }),
      Question.count({ where: { ...filter, difficulty_level: 'medium' } }),
      Question.count({ where: { ...filter, difficulty_level: 'hard' } })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        easy: easyCount,
        medium: mediumCount,
        hard: hardCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single question by ID
 */
const getQuestionById = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const { id } = req.params;

    const where = { id };
    if (institutionId) where.institution_id = institutionId;

    const question = await Question.findOne({
      where,
      include: [
        { model: QuestionOption, as: 'options' },
        { model: Subject, as: 'subject' },
        { model: QuestionBank, as: 'question_bank' }
      ]
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: question
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new question manually
 */
const createQuestion = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    let institutionId = req.targetInstitutionId || req.body.institution_id;
    const {
      subject_id,
      question_bank_id,
      topic,
      difficulty_level,
      question_text,
      marks,
      negative_marks,
      explanation,
      language,
      options
    } = req.body;

    if (!subject_id || !question_text || !options || !Array.isArray(options) || options.length < 4) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Subject, Question Text, and at least 4 options (A, B, C, D) are required.'
      });
    }

    // Verify exactly one option is marked correct
    const correctCount = options.filter(o => o.is_correct === true).length;
    if (correctCount !== 1) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Exactly one option must be designated as the correct answer.'
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

    if (!institutionId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Institution ID could not be determined. Please verify that a valid Subject is selected.'
      });
    }

    const question = await Question.create({
      institution_id: institutionId,
      subject_id: parseInt(subject_id, 10),
      question_bank_id: question_bank_id ? parseInt(question_bank_id, 10) : null,
      topic: topic?.trim() || 'General',
      difficulty_level: ['easy', 'medium', 'hard'].includes(difficulty_level) ? difficulty_level : 'medium',
      question_text: question_text.trim(),
      question_type: 'mcq',
      language: language || 'en',
      marks: parseFloat(marks || 1.0),
      negative_marks: parseFloat(negative_marks || 0.0),
      explanation: explanation?.trim() || null,
      is_verified: true,
      status: 'approved',
      created_by: req.user.id
    }, { transaction });

    // Insert options
    const optionRecords = options.map(opt => ({
      question_id: question.id,
      option_key: opt.option_key,
      option_text: opt.option_text.trim(),
      is_correct: !!opt.is_correct
    }));

    await QuestionOption.bulkCreate(optionRecords, { transaction });
    await transaction.commit();

    await recordAuditLog({
      req,
      action: 'CREATE_QUESTION',
      entity_type: 'Question',
      entity_id: question.id,
      details: { topic: question.topic, difficulty: question.difficulty_level }
    });

    // Fetch full question with options to return
    const created = await Question.findByPk(question.id, {
      include: [{ model: QuestionOption, as: 'options' }]
    });

    return res.status(201).json({
      success: true,
      message: 'Question created successfully in Question Bank.',
      data: created
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Update an existing question and its options
 */
const updateQuestion = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.targetInstitutionId;
    const { id } = req.params;
    const {
      subject_id,
      question_bank_id,
      topic,
      difficulty_level,
      question_text,
      marks,
      negative_marks,
      explanation,
      language,
      options
    } = req.body;

    const where = { id };
    if (institutionId) where.institution_id = institutionId;

    const question = await Question.findOne({ where, transaction });
    if (!question) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Question not found.'
      });
    }

    if (options && Array.isArray(options)) {
      const correctCount = options.filter(o => o.is_correct === true).length;
      if (correctCount !== 1) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Exactly one option must be designated as the correct answer.'
        });
      }
    }

    let targetInstId = question.institution_id;
    if (subject_id && parseInt(subject_id, 10) !== question.subject_id) {
      const parentSubject = await Subject.findByPk(parseInt(subject_id, 10), { transaction });
      if (parentSubject) {
        targetInstId = parentSubject.institution_id;
      }
    }

    await question.update({
      institution_id: targetInstId,
      subject_id: subject_id ? parseInt(subject_id, 10) : question.subject_id,
      question_bank_id: question_bank_id !== undefined ? (question_bank_id ? parseInt(question_bank_id, 10) : null) : question.question_bank_id,
      topic: topic !== undefined ? topic.trim() : question.topic,
      difficulty_level: difficulty_level || question.difficulty_level,
      question_text: question_text !== undefined ? question_text.trim() : question.question_text,
      marks: marks !== undefined ? parseFloat(marks) : question.marks,
      negative_marks: negative_marks !== undefined ? parseFloat(negative_marks) : question.negative_marks,
      explanation: explanation !== undefined ? explanation.trim() : question.explanation,
      language: language || question.language
    }, { transaction });

    // Update options if provided
    if (options && Array.isArray(options)) {
      for (const opt of options) {
        if (opt.id) {
          await QuestionOption.update({
            option_text: opt.option_text.trim(),
            is_correct: !!opt.is_correct
          }, {
            where: { id: opt.id, question_id: question.id },
            transaction
          });
        } else {
          // Find by option_key
          const existingOpt = await QuestionOption.findOne({
            where: { question_id: question.id, option_key: opt.option_key },
            transaction
          });
          if (existingOpt) {
            await existingOpt.update({
              option_text: opt.option_text.trim(),
              is_correct: !!opt.is_correct
            }, { transaction });
          } else {
            await QuestionOption.create({
              question_id: question.id,
              option_key: opt.option_key,
              option_text: opt.option_text.trim(),
              is_correct: !!opt.is_correct
            }, { transaction });
          }
        }
      }
    }

    await transaction.commit();

    await recordAuditLog({
      req,
      action: 'UPDATE_QUESTION',
      entity_type: 'Question',
      entity_id: question.id,
      details: { topic: question.topic, difficulty: question.difficulty_level }
    });

    const updated = await Question.findByPk(question.id, {
      include: [{ model: QuestionOption, as: 'options' }]
    });

    return res.status(200).json({
      success: true,
      message: 'Question updated successfully.',
      data: updated
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Delete a question
 */
const deleteQuestion = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const { id } = req.params;

    const where = { id };
    if (institutionId) where.institution_id = institutionId;

    const question = await Question.findOne({ where });
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.'
      });
    }

    // Check if question is attached to an exam
    const examLinkCount = await ExamQuestion.count({ where: { question_id: id } });
    if (examLinkCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This question cannot be deleted because it is assigned to ${examLinkCount} active/scheduled examination(s).`
      });
    }

    await QuestionOption.destroy({ where: { question_id: id } });
    await question.destroy();

    await recordAuditLog({
      req,
      action: 'DELETE_QUESTION',
      entity_type: 'Question',
      entity_id: id,
      details: { question_text: question.question_text.slice(0, 50) }
    });

    return res.status(200).json({
      success: true,
      message: 'Question deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk delete questions
 */
const bulkDeleteQuestions = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.targetInstitutionId;
    const { question_ids } = req.body;

    if (!question_ids || !Array.isArray(question_ids) || question_ids.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'An array of question IDs is required.'
      });
    }

    const where = { id: { [Op.in]: question_ids } };
    if (institutionId) where.institution_id = institutionId;

    // Check if any question is assigned to active exams
    const linked = await ExamQuestion.findAll({
      where: { question_id: { [Op.in]: question_ids } },
      transaction
    });

    const linkedIds = new Set(linked.map(l => l.question_id));
    const deletableIds = question_ids.filter(id => !linkedIds.has(id));

    if (deletableIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'None of the selected questions could be deleted because they are assigned to scheduled examinations.'
      });
    }

    await QuestionOption.destroy({
      where: { question_id: { [Op.in]: deletableIds } },
      transaction
    });

    const deletedCount = await Question.destroy({
      where: { id: { [Op.in]: deletableIds } },
      transaction
    });

    await transaction.commit();

    await recordAuditLog({
      req,
      action: 'BULK_DELETE_QUESTIONS',
      entity_type: 'Question',
      details: { deleted_count: deletedCount, skipped_count: linkedIds.size }
    });

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} question(s). ${linkedIds.size > 0 ? `(${linkedIds.size} skipped due to active exams)` : ''}`,
      deletedCount,
      skippedCount: linkedIds.size
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  getQuestions,
  getTopicsBySubject,
  getQuestionStats,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkDeleteQuestions
};
