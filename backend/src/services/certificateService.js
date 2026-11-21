const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { Certificate, ExamResult, Exam, Student, User, Institution } = require('../models');
const logger = require('../utils/logger');

/**
 * Generate Certificate records in bulk for an examination.
 * @param {number} examId - Examination ID
 * @param {object} options - Options { onlyPassed: boolean, signature: string }
 * @returns {Promise<object>} Generation statistics
 */
const generateExamCertificates = async (examId, options = {}) => {
  try {
    const exam = await Exam.findByPk(examId, {
      include: [{ model: Institution, as: 'institution' }]
    });
    if (!exam) throw new Error(`Exam ${examId} not found.`);

    const onlyPassed = options.onlyPassed !== false;
    const whereClause = { exam_id: examId };
    if (onlyPassed) {
      whereClause.is_passed = true;
    }

    const results = await ExamResult.findAll({
      where: whereClause,
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user' }]
        }
      ]
    });

    if (results.length === 0) {
      return { generated: 0, total: 0, message: 'No eligible candidate results found for certificate issuance.' };
    }

    const now = new Date();
    const issueDateStr = now.toISOString().split('T')[0];
    const signatureName = options.signature || 'Controller of Examinations';

    let generatedCount = 0;

    for (const r of results) {
      const uniqueSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const certUuid = `CERT-${exam.id}-${r.student_id}-${uniqueSuffix}`;

      const [certRecord, created] = await Certificate.findOrCreate({
        where: { exam_id: exam.id, student_id: r.student_id },
        defaults: {
          institution_id: exam.institution_id,
          certificate_uuid: certUuid,
          exam_id: exam.id,
          student_id: r.student_id,
          rank: r.rank,
          percentage: r.percentage,
          marks_obtained: r.total_marks_obtained,
          total_marks: r.max_marks,
          issue_date: issueDateStr,
          authorized_signature: signatureName
        }
      });

      if (!created) {
        certRecord.rank = r.rank;
        certRecord.percentage = r.percentage;
        certRecord.marks_obtained = r.total_marks_obtained;
        certRecord.total_marks = r.max_marks;
        certRecord.issue_date = issueDateStr;
        certRecord.authorized_signature = signatureName;
        await certRecord.save();
      }

      generatedCount++;
    }

    logger.info(`[CertificateService] Generated/Updated ${generatedCount} certificates for exam ${examId}.`);
    return {
      success: true,
      examId,
      generatedCount,
      totalEligible: results.length
    };
  } catch (error) {
    logger.error(`[CertificateService] Error generating certificates for exam ${examId}:`, error);
    throw error;
  }
};

/**
 * Builds an official high-resolution landscape PDF certificate document using pdf-lib.
 * @param {string} certificateUuid - Certificate UUID
 * @returns {Promise<Buffer>} Binary PDF Buffer
 */
const buildCertificatePdfBuffer = async (certificateUuid) => {
  const certificate = await Certificate.findOne({
    where: { certificate_uuid: certificateUuid },
    include: [
      {
        model: Student,
        as: 'student',
        include: [{ model: User, as: 'user' }]
      },
      {
        model: Exam,
        as: 'exam',
        include: [{ model: Institution, as: 'institution' }]
      }
    ]
  });

  if (!certificate) {
    throw new Error(`Certificate with UUID ${certificateUuid} not found.`);
  }

  // Create A4 Landscape Document: 841.89 x 595.28 pt
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();

  // Load Standard Professional Fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // Palettes: Royal Navy & Warm Gold
  const navy = rgb(0.06, 0.16, 0.36);
  const gold = rgb(0.82, 0.65, 0.20);
  const darkGray = rgb(0.2, 0.2, 0.25);
  const lightGold = rgb(0.96, 0.93, 0.85);

  // 1. Decorative Double Outer Border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderWidth: 4,
    borderColor: navy,
    color: rgb(0.99, 0.99, 0.99)
  });

  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderWidth: 1.5,
    borderColor: gold
  });

  // 2. Corner Ornament Blocks
  const drawCorner = (cx, cy) => {
    page.drawSquare({ x: cx, y: cy, size: 8, color: gold });
  };
  drawCorner(24, 24);
  drawCorner(width - 32, 24);
  drawCorner(24, height - 32);
  drawCorner(width - 32, height - 32);

  // 3. Institution Header
  const institutionName = (certificate.exam?.institution?.name || 'EXAMMATRIX ACADEMIC INSTITUTION').toUpperCase();
  const instWidth = fontBold.widthOfTextAtSize(institutionName, 17);
  page.drawText(institutionName, {
    x: (width - instWidth) / 2,
    y: height - 70,
    size: 17,
    font: fontBold,
    color: navy
  });

  const subHeader = 'DIRECTORATE OF ONLINE EXAMINATIONS & STUDENT EVALUATION';
  const subWidth = fontRegular.widthOfTextAtSize(subHeader, 9);
  page.drawText(subHeader, {
    x: (width - subWidth) / 2,
    y: height - 88,
    size: 9,
    font: fontRegular,
    color: darkGray
  });

  // Horizontal Accent Ribbon
  page.drawLine({
    start: { x: width / 2 - 140, y: height - 98 },
    end: { x: width / 2 + 140, y: height - 98 },
    thickness: 1.5,
    color: gold
  });

  // 4. Certificate Main Title
  const certTitle = 'CERTIFICATE OF MERIT & ACHIEVEMENT';
  const titleWidth = fontSerif.widthOfTextAtSize(certTitle, 26);
  page.drawText(certTitle, {
    x: (width - titleWidth) / 2,
    y: height - 145,
    size: 26,
    font: fontSerif,
    color: navy
  });

  // 5. Presentation Statement
  const certifyText = 'This is proudly and officially conferred upon';
  const certifyWidth = fontItalic.widthOfTextAtSize(certifyText, 13);
  page.drawText(certifyText, {
    x: (width - certifyWidth) / 2,
    y: height - 185,
    size: 13,
    font: fontItalic,
    color: darkGray
  });

  // 6. Student Name in Large Bold Serif
  const studentName = (certificate.student?.user?.name || 'Candidate Name').toUpperCase();
  const nameWidth = fontSerif.widthOfTextAtSize(studentName, 28);
  page.drawText(studentName, {
    x: (width - nameWidth) / 2,
    y: height - 230,
    size: 28,
    font: fontSerif,
    color: navy
  });

  // Name Underline Rule
  page.drawLine({
    start: { x: width / 2 - Math.max(160, nameWidth / 2 + 20), y: height - 238 },
    end: { x: width / 2 + Math.max(160, nameWidth / 2 + 20), y: height - 238 },
    thickness: 1,
    color: gold
  });

  // Student Identification details
  const idText = `Student Identification: ${certificate.student?.student_id || 'N/A'}`;
  const idWidth = fontRegular.widthOfTextAtSize(idText, 10);
  page.drawText(idText, {
    x: (width - idWidth) / 2,
    y: height - 255,
    size: 10,
    font: fontRegular,
    color: darkGray
  });

  // 7. Assessment Completion Statement
  const examTitle = certificate.exam?.title || 'Examination Assessment';
  const examStatement = `for successfully undertaking and demonstrating exemplary competence in the assessment`;
  const exStmtWidth = fontRegular.widthOfTextAtSize(examStatement, 12);
  page.drawText(examStatement, {
    x: (width - exStmtWidth) / 2,
    y: height - 290,
    size: 12,
    font: fontRegular,
    color: darkGray
  });

  const examTitleWidth = fontBold.widthOfTextAtSize(`"${examTitle}"`, 16);
  page.drawText(`"${examTitle}"`, {
    x: (width - examTitleWidth) / 2,
    y: height - 315,
    size: 16,
    font: fontBold,
    color: navy
  });

  // 8. Performance Metrics Box (Rank, Score, Percentage)
  const rankStr = certificate.rank ? `Rank #${certificate.rank}` : 'Rank: Top Tier';
  const scoreStr = `Score: ${certificate.marks_obtained} / ${certificate.total_marks}`;
  const pctStr = `Percentage: ${certificate.percentage}%`;
  const metricsCombined = `${rankStr}   •   ${scoreStr}   •   ${pctStr}   •   Status: PASSED`;
  const metricsWidth = fontBold.widthOfTextAtSize(metricsCombined, 12);

  // Background pill for metrics
  page.drawRectangle({
    x: (width - metricsWidth - 30) / 2,
    y: height - 365,
    width: metricsWidth + 30,
    height: 28,
    color: lightGold,
    borderColor: gold,
    borderWidth: 1
  });

  page.drawText(metricsCombined, {
    x: (width - metricsWidth) / 2,
    y: height - 355,
    size: 12,
    font: fontBold,
    color: navy
  });

  // 9. Footers & Authenticators
  // Left: Date & UUID
  page.drawText(`Issue Date: ${certificate.issue_date}`, {
    x: 60,
    y: 85,
    size: 10,
    font: fontRegular,
    color: darkGray
  });

  page.drawText(`Certificate ID: ${certificate.certificate_uuid}`, {
    x: 60,
    y: 70,
    size: 9,
    font: fontBold,
    color: navy
  });

  page.drawText(`Verify at: /api/certificates/verify/${certificate.certificate_uuid}`, {
    x: 60,
    y: 57,
    size: 8,
    font: fontItalic,
    color: darkGray
  });

  // Center: Official Seal / Stamp Graphics
  page.drawCircle({
    x: width / 2,
    y: 90,
    size: 32,
    borderWidth: 2,
    borderColor: gold,
    color: rgb(1, 1, 1)
  });
  const sealText = 'VERIFIED';
  const sealWidth = fontBold.widthOfTextAtSize(sealText, 8);
  page.drawText(sealText, {
    x: width / 2 - sealWidth / 2,
    y: 87,
    size: 8,
    font: fontBold,
    color: navy
  });

  // Right: Signature Block
  const sigLineStart = width - 260;
  page.drawLine({
    start: { x: sigLineStart, y: 88 },
    end: { x: width - 60, y: 88 },
    thickness: 1.2,
    color: navy
  });

  const sigName = certificate.authorized_signature || 'Controller of Examinations';
  const sigWidth = fontBold.widthOfTextAtSize(sigName, 11);
  page.drawText(sigName, {
    x: sigLineStart + (200 - sigWidth) / 2,
    y: 73,
    size: 11,
    font: fontBold,
    color: navy
  });

  const sigTitle = 'Office of Academic Affairs';
  const sigTitleWidth = fontRegular.widthOfTextAtSize(sigTitle, 9);
  page.drawText(sigTitle, {
    x: sigLineStart + (200 - sigTitleWidth) / 2,
    y: 60,
    size: 9,
    font: fontRegular,
    color: darkGray
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};

module.exports = {
  generateExamCertificates,
  buildCertificatePdfBuffer
};
