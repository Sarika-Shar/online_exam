const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');

const {
  sequelize,
  Institution,
  User,
  Student,
  Class,
  Batch,
  Subject,
  Exam,
  ExamQuestion,
  ExamAttempt,
  StudentAnswer,
  ExamResult,
  Question,
  QuestionOption,
  ProctorSnapshot,
  AuditLog
} = require('../models');

const {
  uploadSnapshot,
  getAttemptEvidence,
  submitProctorVerdict,
  getExamIntegrityOverview
} = require('../controllers/proctorController');

// Helper to mock Express req, res, next
const createMockReqRes = (options = {}) => {
  const req = {
    institutionId: options.institutionId || 1,
    user: options.user || { id: 1, role: 'institution_admin', name: 'Admin Test' },
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    headers: { 'user-agent': 'Phase12-SurveillanceTestRunner' },
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
    app: {
      get: (key) => {
        if (key === 'io') {
          return {
            to: () => ({
              emit: () => {}
            })
          };
        }
        return null;
      }
    }
  };

  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };

  const next = (err) => {
    if (err) throw err;
  };

  return { req, res, next };
};

const runPhase12Tests = async () => {
  console.log('================================================================');
  console.log('🛡️ ENTERPRISE ONLINE EXAMINATION - PHASE 12 TEST SUITE');
  console.log('Features: AI Proctoring Snapshot Surveillance, Trust Scoring & Evidence Studio');
  console.log('================================================================\n');

  try {
    await sequelize.authenticate();
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA journal_mode = WAL;');
      await sequelize.query('PRAGMA busy_timeout = 25000;');
    }
    await sequelize.sync();

    // Ensure proctor surveillance columns exist on exam_attempts
    const dialect = sequelize.getDialect();
    if (dialect === 'sqlite') {
      const [columns] = await sequelize.query("PRAGMA table_info(exam_attempts);");
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('integrity_score')) {
        await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN integrity_score INTEGER DEFAULT 100;");
      }
      if (!columnNames.includes('proctor_verdict')) {
        await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN proctor_verdict TEXT DEFAULT 'pending';");
      }
      if (!columnNames.includes('proctor_notes')) {
        await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN proctor_notes TEXT;");
      }
      if (!columnNames.includes('proctor_reviewed_by')) {
        await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN proctor_reviewed_by INTEGER;");
      }
      if (!columnNames.includes('proctor_reviewed_at')) {
        await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN proctor_reviewed_at DATETIME;");
      }
    }
    console.log('✓ Database connection authenticated & models synchronized.');

    // 1. Setup Base Institution, Class, Batch & Subject
    let inst = await Institution.findByPk(1);
    if (!inst) inst = await Institution.findOne();

    let cls = await Class.findOne({ where: { institution_id: inst.id } });
    if (!cls) cls = await Class.create({ institution_id: inst.id, name: 'B.Tech IT - Year 4' });

    let batch = await Batch.findOne({ where: { class_id: cls.id } });
    if (!batch) {
      batch = await Batch.create({
        institution_id: inst.id,
        class_id: cls.id,
        name: 'Batch 2026-P12',
        start_year: 2023,
        end_year: 2027
      });
    }

    let subject = await Subject.findOne({ where: { institution_id: inst.id } });
    if (!subject) {
      subject = await Subject.create({
        institution_id: inst.id,
        code: 'PROCT101',
        name: 'Digital Ethics & Proctoring Architecture'
      });
    }

    // 2. Setup Proctor Test Exam
    const today = new Date().toISOString().split('T')[0];
    const startTime = new Date();
    const endTime = new Date(Date.now() + 3600000 * 24);

    const testExam = await Exam.create({
      institution_id: inst.id,
      created_by: 1,
      subject_id: subject.id,
      class_id: cls.id,
      batch_id: batch.id,
      exam_date: today,
      start_time: startTime,
      end_time: endTime,
      title: 'Proctor Surveillance Certification 2026',
      duration_minutes: 60,
      total_questions: 10,
      total_marks: 100,
      marks_per_question: 10,
      negative_marking: 2.5,
      selection_mode: 'manual_fixed',
      status: 'published'
    });
    console.log(`✓ Setup test exam [ID: ${testExam.id}] "${testExam.title}"`);

    // 3. Create Test Candidate 1 (Will have anomalies and auto-flagging)
    const email1 = `proctor_cand1_${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('Secret123!', 8);
    const user1 = await User.create({
      institution_id: inst.id,
      name: 'Audited Candidate Alpha',
      email: email1,
      username: `cand1_${Date.now()}`,
      password_hash: passwordHash,
      role: 'student'
    });
    const student1 = await Student.create({
      institution_id: inst.id,
      user_id: user1.id,
      class_id: cls.id,
      batch_id: batch.id,
      student_id: `AUD-${Date.now().toString().slice(-4)}`,
      roll_no: `ROLL-P12-${Math.floor(Math.random() * 9000 + 1000)}`,
      is_active: true
    });

    const attempt1 = await ExamAttempt.create({
      institution_id: inst.id,
      exam_id: testExam.id,
      student_id: student1.id,
      attempt_number: 1,
      start_time: new Date(),
      server_expiry_time: new Date(Date.now() + 3600000),
      status: 'submitted',
      integrity_score: 100,
      proctor_verdict: 'pending',
      ip_address: '192.168.1.101',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0'
    });

    await ExamResult.create({
      institution_id: inst.id,
      exam_id: testExam.id,
      student_id: student1.id,
      exam_attempt_id: attempt1.id,
      total_questions: 10,
      total_attempted: 10,
      total_correct: 8,
      total_wrong: 2,
      max_marks: 100,
      total_marks_obtained: 75,
      percentage: 75.0,
      is_passed: true,
      rank: 1
    });

    // -----------------------------------------------------------------
    // TEST 1: Candidate Periodic Clean Snapshot Upload
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Periodic Clean Snapshot Stream ---');
    {
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        user: { id: user1.id, role: 'student', name: user1.name },
        body: {
          exam_attempt_id: attempt1.id,
          snapshot_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
          snapshot_type: 'periodic',
          anomaly_detected: false,
          anomaly_type: 'NONE',
          confidence_score: 1.0
        }
      });

      await uploadSnapshot(req, res, next);
      if (res.statusCode !== 201 || !res.data.success) {
        throw new Error(`Upload clean snapshot failed with status ${res.statusCode}: ${JSON.stringify(res.data)}`);
      }

      if (res.data.data.integrityScore !== 100) {
        throw new Error(`Expected clean integrity score 100, got ${res.data.data.integrityScore}`);
      }

      console.log('✓ Clean snapshot uploaded successfully. Integrity score maintained at 100.');
    }

    // -----------------------------------------------------------------
    // TEST 2: Anomaly Detection Snapshot & Score Penalty Deduction
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Anomaly Detection & Trust Score Penalty ---');
    {
      // Anomaly 1: Multiple Faces (-25 penalty)
      const { req: req1, res: res1, next: next1 } = createMockReqRes({
        institutionId: inst.id,
        user: { id: user1.id, role: 'student', name: user1.name },
        body: {
          exam_attempt_id: attempt1.id,
          snapshot_url: 'data:image/jpeg;base64,anomaly_multiple_faces_data...',
          snapshot_type: 'anomaly',
          anomaly_detected: true,
          anomaly_type: 'MULTIPLE_FACES',
          confidence_score: 0.94
        }
      });

      await uploadSnapshot(req1, res1, next1);
      if (res1.data.data.integrityScore !== 75) {
        throw new Error(`Expected integrity score 75 after MULTIPLE_FACES (-25), got ${res1.data.data.integrityScore}`);
      }
      console.log('✓ MULTIPLE_FACES penalty deducted 25 points. Integrity score: 75/100.');

      // Anomaly 2: Tab Switch (-10 penalty -> drops to 65 < 70 threshold -> auto flags suspicious)
      const { req: req2, res: res2, next: next2 } = createMockReqRes({
        institutionId: inst.id,
        user: { id: user1.id, role: 'student', name: user1.name },
        body: {
          exam_attempt_id: attempt1.id,
          snapshot_url: 'data:image/jpeg;base64,anomaly_tab_switch_data...',
          snapshot_type: 'anomaly',
          anomaly_detected: true,
          anomaly_type: 'TAB_SWITCH',
          confidence_score: 0.98
        }
      });

      await uploadSnapshot(req2, res2, next2);
      if (res2.data.data.integrityScore !== 65) {
        throw new Error(`Expected integrity score 65 after TAB_SWITCH (-10), got ${res2.data.data.integrityScore}`);
      }
      if (res2.data.data.proctorVerdict !== 'suspicious_flagged') {
        throw new Error(`Expected auto-flagging to 'suspicious_flagged', got ${res2.data.data.proctorVerdict}`);
      }
      console.log('✓ TAB_SWITCH penalty deducted 10 points. Integrity score: 65/100.');
      console.log('✓ Auto-flagging triggered: proctor_verdict transitioned to "suspicious_flagged".');
    }

    // -----------------------------------------------------------------
    // TEST 3: Retrieve Candidate Surveillance Evidence & Timeline
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Retrieve Candidate Evidence & Audit Timeline ---');
    {
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        params: { attemptId: attempt1.id }
      });

      await getAttemptEvidence(req, res, next);
      if (res.statusCode !== 200 || !res.data.success) {
        throw new Error(`Failed to retrieve evidence: ${JSON.stringify(res.data)}`);
      }

      const evidence = res.data.data;
      if (evidence.snapshots.length !== 3) {
        throw new Error(`Expected 3 snapshots recorded, got ${evidence.snapshots.length}`);
      }
      if (evidence.metrics.anomalyCount !== 2) {
        throw new Error(`Expected 2 anomalies detected, got ${evidence.metrics.anomalyCount}`);
      }
      if (evidence.metrics.anomalyCounts.MULTIPLE_FACES !== 1 || evidence.metrics.anomalyCounts.TAB_SWITCH !== 1) {
        throw new Error(`Anomaly breakdown mismatch: ${JSON.stringify(evidence.metrics.anomalyCounts)}`);
      }

      console.log(`✓ Retrieved candidate evidence: ${evidence.candidate.name} (Roll: ${evidence.candidate.rollNo})`);
      console.log(`✓ Total Snapshots: ${evidence.metrics.totalSnapshots}, Anomalies: ${evidence.metrics.anomalyCount}, Trust Score: ${evidence.attempt.integrityScore}/100.`);
    }

    // -----------------------------------------------------------------
    // TEST 4: Submit Official Proctor Verdict (Disqualification & Result Invalidation)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Official Proctor Verdict & Candidate Disqualification ---');
    {
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        user: { id: 1, role: 'institution_admin', name: 'Chief Proctor' },
        params: { attemptId: attempt1.id },
        body: {
          verdict: 'disqualified',
          notes: 'Confirmed unauthorized multi-person presence and window minimization repeatedly during assessment.'
        }
      });

      await submitProctorVerdict(req, res, next);
      if (res.statusCode !== 200 || !res.data.success) {
        throw new Error(`Failed to submit proctor verdict: ${JSON.stringify(res.data)}`);
      }

      // Verify Attempt status and ExamResult voiding
      const updatedAttempt = await ExamAttempt.findByPk(attempt1.id);
      const updatedResult = await ExamResult.findOne({ where: { exam_attempt_id: attempt1.id } });

      if (updatedAttempt.proctor_verdict !== 'disqualified' || updatedAttempt.status !== 'disqualified') {
        throw new Error(`Expected attempt status and verdict to be disqualified, got ${updatedAttempt.status} / ${updatedAttempt.proctor_verdict}`);
      }
      if (updatedResult.is_passed !== false || updatedResult.total_marks_obtained !== 0) {
        throw new Error(`Expected result to be invalidated with 0 marks, got is_passed=${updatedResult.is_passed}, marks=${updatedResult.total_marks_obtained}`);
      }

      console.log('✓ Proctor verdict "disqualified" successfully recorded.');
      console.log('✓ Candidate attempt status set to "disqualified".');
      console.log('✓ ExamResult invalidated: marks set to 0 and is_passed set to false.');
    }

    // -----------------------------------------------------------------
    // TEST 5: Create Candidate 2 (Clean Verified) & Cohort Overview
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Cohort Proctoring Overview & Aggregations ---');
    {
      // Create second student who passes cleanly
      const email2 = `proctor_cand2_${Date.now()}@example.com`;
      const user2 = await User.create({
        institution_id: inst.id,
        name: 'Clean Candidate Beta',
        email: email2,
        username: `cand2_${Date.now()}`,
        password_hash: passwordHash,
        role: 'student'
      });
      const student2 = await Student.create({
        institution_id: inst.id,
        user_id: user2.id,
        class_id: cls.id,
        batch_id: batch.id,
        student_id: `AUD-${Date.now().toString().slice(-4)}`,
        roll_no: `ROLL-P12-${Math.floor(Math.random() * 9000 + 1000)}`,
        is_active: true
      });

      const attempt2 = await ExamAttempt.create({
        institution_id: inst.id,
        exam_id: testExam.id,
        student_id: student2.id,
        attempt_number: 1,
        start_time: new Date(),
        server_expiry_time: new Date(Date.now() + 3600000),
        status: 'submitted',
        integrity_score: 95,
        proctor_verdict: 'verified_clean',
        ip_address: '192.168.1.102',
        user_agent: 'Mozilla/5.0 Chrome/120.0'
      });

      await ProctorSnapshot.create({
        institution_id: inst.id,
        exam_attempt_id: attempt2.id,
        student_id: student2.id,
        snapshot_url: 'data:image/jpeg;base64,clean_stream...',
        snapshot_type: 'periodic',
        anomaly_detected: false,
        anomaly_type: 'NONE',
        confidence_score: 1.0,
        captured_at: new Date()
      });

      // Call getExamIntegrityOverview
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        params: { examId: testExam.id }
      });

      await getExamIntegrityOverview(req, res, next);
      if (res.statusCode !== 200 || !res.data.success) {
        throw new Error(`Failed to get exam integrity overview: ${JSON.stringify(res.data)}`);
      }

      const overview = res.data.overview;
      const candidates = res.data.candidates;

      if (overview.totalMonitored < 2) {
        throw new Error(`Expected at least 2 monitored candidates, got ${overview.totalMonitored}`);
      }
      if (overview.verdicts.disqualified < 1) {
        throw new Error(`Expected at least 1 disqualified candidate in overview`);
      }
      if (overview.verdicts.clean < 1) {
        throw new Error(`Expected at least 1 clean candidate in overview`);
      }

      console.log(`✓ Cohort Overview: ${overview.totalMonitored} candidates monitored.`);
      console.log(`✓ Cohort Avg Integrity Score: ${overview.averageIntegrityScore}%`);
      console.log(`✓ Verdicts summary: Disqualified: ${overview.verdicts.disqualified}, Clean: ${overview.verdicts.clean}, Flagged: ${overview.verdicts.flagged}.`);
      console.log(`✓ Candidate list count: ${candidates.length}`);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 12 AUTOMATED TESTS PASSED SUCCESSFULLY (5/5)');
    console.log('================================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ PHASE 12 TEST SUITE FAILED:', error);
    process.exit(1);
  }
};

runPhase12Tests();
