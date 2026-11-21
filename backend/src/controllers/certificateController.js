const { Certificate, Exam, Student, User, Class, Batch } = require('../models');
const { generateExamCertificates, buildCertificatePdfBuffer } = require('../services/certificateService');
const { recordAuditLog } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/**
 * Generate certificates in bulk for an exam (Admin)
 */
const generateCertificates = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const { only_passed = true, signature } = req.body;

    const result = await generateExamCertificates(examId, {
      onlyPassed: only_passed,
      signature
    });

    await recordAuditLog({
      req,
      action: 'GENERATE_CERTIFICATES',
      entity_type: 'Exam',
      entity_id: examId,
      details: { generatedCount: result.generatedCount, totalEligible: result.totalEligible }
    });

    return res.status(200).json({
      success: true,
      message: `Successfully generated ${result.generatedCount} certificates.`,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated certificates list with filters (Admin)
 */
const getCertificates = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { exam_id, search, page = 1, limit = 20 } = req.query;

    const whereClause = { institution_id: institutionId };
    if (exam_id) whereClause.exam_id = exam_id;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await Certificate.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            { model: User, as: 'user', attributes: ['name', 'email'] },
            { model: Class, as: 'class', attributes: ['name'] }
          ]
        },
        {
          model: Exam,
          as: 'exam',
          attributes: ['id', 'title', 'exam_date', 'total_marks']
        }
      ],
      order: [
        ['exam_id', 'DESC'],
        ['rank', 'ASC'],
        ['percentage', 'DESC']
      ],
      limit: parseInt(limit, 10),
      offset
    });

    return res.status(200).json({
      success: true,
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / parseInt(limit, 10)),
      certificates: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download Certificate PDF by UUID
 */
const downloadCertificate = async (req, res, next) => {
  try {
    const { certificateUuid } = req.params;
    const pdfBuffer = await buildCertificatePdfBuffer(certificateUuid);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certificateUuid}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Public Certificate Verification Endpoint (Section 13)
 */
const verifyCertificate = async (req, res, next) => {
  try {
    const { certificateUuid } = req.params;

    const cert = await Certificate.findOne({
      where: { certificate_uuid: certificateUuid },
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['name'] }]
        },
        {
          model: Exam,
          as: 'exam',
          attributes: ['title', 'exam_date']
        }
      ]
    });

    if (!cert) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'Invalid certificate ID. This credential could not be verified in the institutional database.'
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      certificate: {
        uuid: cert.certificate_uuid,
        studentName: cert.student?.user?.name,
        studentId: cert.student?.student_id,
        examTitle: cert.exam?.title,
        examDate: cert.exam?.exam_date,
        rank: cert.rank,
        marksObtained: cert.marks_obtained,
        totalMarks: cert.total_marks,
        percentage: cert.percentage,
        issueDate: cert.issue_date,
        authorizedSignature: cert.authorized_signature
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Candidate's Own Certificates (Student Portal)
 */
const getMyCertificates = async (req, res, next) => {
  try {
    const studentUser = req.user;

    const student = await Student.findOne({ where: { user_id: studentUser.id } });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const certificates = await Certificate.findAll({
      where: { student_id: student.id },
      include: [
        {
          model: Exam,
          as: 'exam',
          attributes: ['id', 'title', 'exam_date', 'total_marks']
        }
      ],
      order: [['issue_date', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      certificates
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateCertificates,
  getCertificates,
  downloadCertificate,
  verifyCertificate,
  getMyCertificates
};
