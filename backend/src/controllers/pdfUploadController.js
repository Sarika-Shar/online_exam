const { sequelize, PdfUpload, Question, QuestionOption, Subject, QuestionBank, Institution } = require('../models');
const { extractRawTextFromPdf, performOcr, parseQuestionsFromText, normalizeText } = require('../utils/pdfExtractor');
const { recordAuditLog } = require('../middleware/auditLogger');
const logger = require('../utils/logger');
const fs = require('fs');

/**
 * Upload PDF and extract MCQ questions (Text or OCR)
 */
const uploadAndExtract = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file was uploaded. Please select a valid PDF file.'
      });
    }

    const { subject_id, question_bank_id, forceOcr, ocrLanguage } = req.body;
    let institutionId = req.targetInstitutionId || req.body.institution_id;

    if (!institutionId && subject_id) {
      const parentSubject = await Subject.findByPk(parseInt(subject_id, 10));
      if (parentSubject) {
        institutionId = parentSubject.institution_id;
      }
    }

    if (!institutionId) {
      const defaultInst = await Institution.findOne({ where: { is_active: true } });
      if (defaultInst) {
        institutionId = defaultInst.id;
      }
    }

    logger.info(`Received PDF upload: ${req.file.originalname} (${req.file.size} bytes) for institution ${institutionId}`);

    // Create entry in pdf_uploads table
    const pdfRecord = await PdfUpload.create({
      institution_id: institutionId,
      uploaded_by: req.user.id,
      file_name: req.file.originalname,
      file_path: req.file.path,
      status: 'processing',
      ocr_applied: false
    });

    let rawText = '';
    let isScanned = false;
    let pageCount = 1;

    try {
      // Step 1: Text extraction via pdf-parse
      const parseResult = await extractRawTextFromPdf(req.file.path);
      rawText = parseResult.text;
      isScanned = parseResult.isScanned;
      pageCount = parseResult.numpages;

      // Step 2: If scanned or forceOcr was requested, perform OCR
      if (isScanned || forceOcr === 'true' || forceOcr === true) {
        logger.info(`PDF is scanned or OCR requested. Executing Tesseract OCR on ${req.file.originalname}...`);
        const lang = ocrLanguage || 'eng';
        rawText = await performOcr(req.file.path, lang);
        pdfRecord.ocr_applied = true;
      }
    } catch (parseErr) {
      logger.error('Extraction failed:', parseErr.message);
      await pdfRecord.update({
        status: 'failed',
        error_message: parseErr.message
      });
      return res.status(500).json({
        success: false,
        message: `Failed to extract text from PDF: ${parseErr.message}`
      });
    }

    // Step 3: Parse questions and options
    const parsedQuestions = parseQuestionsFromText(rawText);

    // Step 4: Duplicate Detection against database
    // Fetch all existing questions in the institution (and subject if selected)
    const existingWhere = { institution_id: institutionId };
    if (subject_id) {
      existingWhere.subject_id = subject_id;
    }
    const existingQuestions = await Question.findAll({
      where: existingWhere,
      attributes: ['id', 'question_text', 'subject_id']
    });

    const existingMap = new Map();
    existingQuestions.forEach(eq => {
      existingMap.set(normalizeText(eq.question_text), eq.id);
    });

    const previewQuestions = parsedQuestions.map(q => {
      const normalized = normalizeText(q.question_text);
      const isDuplicate = existingMap.has(normalized);
      return {
        ...q,
        is_duplicate: isDuplicate,
        duplicate_question_id: isDuplicate ? existingMap.get(normalized) : null
      };
    });

    // Update upload record status
    await pdfRecord.update({
      status: 'extracted',
      total_detected: previewQuestions.length
    });

    await recordAuditLog({
      req,
      action: 'PDF_UPLOAD_EXTRACT',
      entity_type: 'PdfUpload',
      entity_id: pdfRecord.id,
      details: {
        file_name: req.file.originalname,
        total_detected: previewQuestions.length,
        is_scanned: isScanned,
        ocr_applied: pdfRecord.ocr_applied
      }
    });

    return res.status(200).json({
      success: true,
      message: `Successfully extracted ${previewQuestions.length} questions. Please review and approve them before publishing.`,
      pdfUpload: {
        id: pdfRecord.id,
        file_name: pdfRecord.file_name,
        page_count: pageCount,
        is_scanned: isScanned,
        ocr_applied: pdfRecord.ocr_applied,
        total_detected: previewQuestions.length
      },
      questions: previewQuestions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve and commit edited questions to MySQL (Section 5 verification requirement)
 */
const approveAndSaveQuestions = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { pdf_upload_id, subject_id, question_bank_id, questions } = req.body;
    let institutionId = req.targetInstitutionId || req.body.institution_id;

    if (!subject_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'A valid Subject must be selected to assign the approved questions.'
      });
    }

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

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No questions were provided for approval.'
      });
    }

    const subjectWhere = { id: subject_id };
    if (institutionId) subjectWhere.institution_id = institutionId;

    // Verify Subject belongs to this institution
    const subject = await Subject.findOne({
      where: subjectWhere,
      transaction
    });

    if (!subject) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Selected Subject not found or not belonging to your institution.'
      });
    }

    let savedCount = 0;
    const savedQuestionIds = [];

    for (const q of questions) {
      // Validate mandatory fields
      if (!q.question_text || !q.correct_answer) {
        continue; // Skip invalid or incomplete items
      }

      // Create Question record with verified = true
      const createdQuestion = await Question.create({
        institution_id: institutionId,
        subject_id: parseInt(subject_id, 10),
        question_bank_id: question_bank_id ? parseInt(question_bank_id, 10) : null,
        topic: q.topic || 'General',
        difficulty_level: ['easy', 'medium', 'hard'].includes(q.difficulty_level) ? q.difficulty_level : 'medium',
        question_text: q.question_text.trim(),
        question_type: 'mcq',
        language: q.language || 'en',
        marks: parseFloat(q.marks || 1.0),
        negative_marks: parseFloat(q.negative_marks || 0.0),
        explanation: q.explanation || null,
        is_verified: true, // APPROVED by admin
        status: 'approved',
        source_pdf_id: pdf_upload_id ? parseInt(pdf_upload_id, 10) : null,
        created_by: req.user.id
      }, { transaction });

      // Create the 4 options
      const optionsToCreate = ['A', 'B', 'C', 'D'].map(key => {
        const found = q.options ? q.options.find(o => o.option_key === key) : null;
        return {
          question_id: createdQuestion.id,
          option_key: key,
          option_text: found ? found.option_text.trim() : `Option ${key}`,
          is_correct: q.correct_answer === key
        };
      });

      await QuestionOption.bulkCreate(optionsToCreate, { transaction });
      savedCount++;
      savedQuestionIds.push(createdQuestion.id);
    }

    // Update PdfUpload status if applicable
    if (pdf_upload_id) {
      const pdfUpload = await PdfUpload.findByPk(pdf_upload_id, { transaction });
      if (pdfUpload) {
        await pdfUpload.update({
          status: 'approved',
          approved_count: savedCount
        }, { transaction });
      }
    }

    await transaction.commit();

    // Audit log
    await recordAuditLog({
      req,
      action: 'APPROVE_PDF_QUESTIONS',
      entity_type: 'Question',
      details: {
        pdf_upload_id,
        subject_id,
        approved_count: savedCount,
        question_ids: savedQuestionIds
      }
    });

    return res.status(201).json({
      success: true,
      message: `Successfully approved and stored ${savedCount} questions into MySQL question bank.`,
      savedCount
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * List historical PDF uploads
 */
const getPdfUploads = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const filter = institutionId ? { institution_id: institutionId } : {};

    const uploads = await PdfUpload.findAll({
      where: filter,
      order: [['created_at', 'DESC']],
      limit: 20
    });

    return res.status(200).json({
      success: true,
      data: uploads
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadAndExtract,
  approveAndSaveQuestions,
  getPdfUploads
};
