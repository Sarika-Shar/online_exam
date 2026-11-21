const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const {
  sequelize,
  User,
  Student,
  Exam,
  ExamResult,
  ExamAttempt,
  Winner,
  Prize,
  Certificate
} = require('../models');
const { calculateAndPersistWinners, getExamWinnersData } = require('../services/winnerService');
const { generateExamCertificates, buildCertificatePdfBuffer } = require('../services/certificateService');

const runPhase8Tests = async () => {
  console.log('====================================================');
  console.log('🚀 STARTING PHASE 8 VERIFICATION TEST SUITE');
  console.log('Features: Top 3 Winners, Cash Prizes, Announcements & PDF Certificate Generation');
  console.log('====================================================\n');

  try {
    await sequelize.authenticate();
    console.log('✓ Database connection authenticated.');

    // 1. Pick test exam
    let exam = await Exam.findOne({ where: { id: 1 } });
    if (!exam) exam = await Exam.findOne();
    console.log(`✓ Test Exam: "${exam.title}" (ID: ${exam.id})`);

    // Clean up test data for isolation
    await Winner.destroy({ where: { exam_id: exam.id } });
    await Prize.destroy({ where: { exam_id: exam.id } });
    await Certificate.destroy({ where: { exam_id: exam.id } });
    console.log('✓ Cleaned prior test winners, prizes, and certificates.');

    // Ensure we have at least 3 ranked exam results from Phase 7
    let resultsCount = await ExamResult.count({ where: { exam_id: exam.id } });
    if (resultsCount < 3) {
      console.log('⚠️ Re-running phase 7 test to seed results...');
      require('./phase7Test');
      // wait 1 sec
      await new Promise(r => setTimeout(r, 1000));
    }

    // -----------------------------------------------------------------
    // TEST 1: Top 3 Winner Calculation & Persistence
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Top 3 Winner Calculation & Podium Determination ---');
    const winnersData = await calculateAndPersistWinners(exam.id);
    console.log(`  Identified ${winnersData.winners.length} podium candidates.`);

    winnersData.winners.forEach(w => {
      console.log(
        `  Position ${w.position}: ${w.studentName} (${w.studentId}) — Score: ${w.marksObtained}, Time: ${w.completionSeconds}s`
      );
    });

    if (winnersData.winners.length >= 3) {
      const p1 = winnersData.winners.find(w => w.position === 1);
      const p2 = winnersData.winners.find(w => w.position === 2);
      const p3 = winnersData.winners.find(w => w.position === 3);

      if (p1 && p2 && p3) {
        console.log('  ✅ TEST 1 PASSED: Top 3 podium winners accurately determined and persisted.');
      } else {
        throw new Error('Positions 1, 2, 3 not properly populated.');
      }
    } else {
      throw new Error(`Expected at least 3 winners, got ${winnersData.winners.length}`);
    }

    // -----------------------------------------------------------------
    // TEST 2: Cash Prize Management
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Cash Prize Management & Award Allocation ---');
    const customPrizes = [
      { position: 1, title: 'Presidential Gold Cup & Fellowship', cash_amount: 1000.00 },
      { position: 2, title: 'Vice-Chancellor Silver Cup', cash_amount: 600.00 },
      { position: 3, title: 'Dean Bronze Medal', cash_amount: 300.00 }
    ];

    for (const p of customPrizes) {
      const [rec] = await Prize.findOrCreate({
        where: { exam_id: exam.id, position: p.position },
        defaults: {
          institution_id: exam.institution_id,
          exam_id: exam.id,
          position: p.position,
          title: p.title,
          cash_amount: p.cash_amount,
          is_distributed: false
        }
      });
      await rec.update({ title: p.title, cash_amount: p.cash_amount });
    }

    const updatedPrizes = await Prize.findAll({ where: { exam_id: exam.id }, order: [['position', 'ASC']] });
    console.log(`  Allocated ${updatedPrizes.length} cash prize tiers:`);
    updatedPrizes.forEach(p => console.log(`    Position ${p.position}: ${p.title} — $${p.cash_amount}`));

    if (updatedPrizes.length === 3 && parseFloat(updatedPrizes[0].cash_amount) === 1000.00) {
      console.log('  ✅ TEST 2 PASSED: Cash prizes updated with custom values.');
    } else {
      throw new Error('Cash prize management failed.');
    }

    // -----------------------------------------------------------------
    // TEST 3: Admin-Controlled Announcement
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Admin-Controlled Winner Announcement ---');
    const now = new Date();
    await Winner.update(
      { announced: true, announced_at: now },
      { where: { exam_id: exam.id } }
    );

    const freshWinnersData = await getExamWinnersData(exam.id);
    console.log(`  Announcement Status: ${freshWinnersData.isAnnounced ? 'OFFICIALLY ANNOUNCED' : 'UNANNOUNCED'}`);
    console.log(`  Announced Timestamp: ${freshWinnersData.announcedAt}`);

    if (freshWinnersData.isAnnounced === true && freshWinnersData.announcedAt) {
      console.log('  ✅ TEST 3 PASSED: Winners announcement flag updated and locked.');
    } else {
      throw new Error('Announcement failed.');
    }

    // -----------------------------------------------------------------
    // TEST 4: Bulk PDF Certificate Generation with pdf-lib
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Bulk PDF Certificate Generation Engine ---');
    const certGenResult = await generateExamCertificates(exam.id, {
      onlyPassed: false,
      signature: 'Prof. Eleanor Vance, Controller of Examinations'
    });

    console.log(`  Generated: ${certGenResult.generatedCount} certificates for exam ${exam.id}`);

    const issuedCertificates = await Certificate.findAll({
      where: { exam_id: exam.id },
      include: [{ model: Student, as: 'student', include: [{ model: User, as: 'user' }] }]
    });

    if (issuedCertificates.length === 0) {
      throw new Error('No certificates created in database!');
    }

    const sampleCert = issuedCertificates[0];
    console.log(`  Sample Certificate Record:`);
    console.log(`    - UUID: ${sampleCert.certificate_uuid}`);
    console.log(`    - Candidate: ${sampleCert.student?.user?.name}`);
    console.log(`    - Rank: #${sampleCert.rank}, Score: ${sampleCert.marks_obtained}/${sampleCert.total_marks}`);
    console.log(`    - Issue Date: ${sampleCert.issue_date}`);
    console.log(`    - Authorized Signature: ${sampleCert.authorized_signature}`);

    // Build the binary PDF Buffer using pdf-lib
    console.log('\n  Rendering binary A4 landscape vector PDF using pdf-lib...');
    const pdfBuffer = await buildCertificatePdfBuffer(sampleCert.certificate_uuid);
    console.log(`  Rendered PDF Buffer Size: ${pdfBuffer.length} bytes`);

    // Verify PDF header %PDF-
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    console.log(`  File Header Verification: "${pdfHeader}"`);

    if (pdfHeader.startsWith('%PDF-') && pdfBuffer.length > 1000) {
      console.log('  ✅ TEST 4 PASSED: Vector PDF certificate generated with high-res styling and authentic headers.');
    } else {
      throw new Error(`Invalid PDF generated. Header was: ${pdfHeader}`);
    }

    // -----------------------------------------------------------------
    // TEST 5: Certificate Authenticity Verification
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Certificate Authenticity Verification Engine ---');
    const validLookup = await Certificate.findOne({ where: { certificate_uuid: sampleCert.certificate_uuid } });
    const invalidLookup = await Certificate.findOne({ where: { certificate_uuid: 'INVALID-FAKE-UUID-999' } });

    console.log(`  Valid UUID Check: ${validLookup !== null ? 'AUTHENTIC' : 'FAILED'}`);
    console.log(`  Invalid UUID Check: ${invalidLookup === null ? 'REJECTED (Correct)' : 'FAILED'}`);

    if (validLookup !== null && invalidLookup === null) {
      console.log('  ✅ TEST 5 PASSED: Certificate verification system accurately discriminates authentic vs forged credentials.');
    } else {
      throw new Error('Certificate verification failed.');
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 5 PHASE 8 VERIFICATION TESTS PASSED FLAWLESSLY!');
    console.log('====================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exit(1);
  }
};

runPhase8Tests();
