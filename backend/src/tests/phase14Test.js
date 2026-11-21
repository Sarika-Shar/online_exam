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
  ExamAssignment,
  ExamAttempt,
  StudentAnswer,
  ExamResult,
  Question,
  QuestionOption,
  AuditLog
} = require('../models');

const {
  getLiveExamStatus,
  extendCandidateTime,
  pauseCandidateAttempt,
  resumeCandidateAttempt,
  sendCandidateWarning,
  forceSubmitAttempt,
  broadcastExamAnnouncement
} = require('../controllers/liveMonitorController');

// Helper to mock Express req, res, next with Socket.IO spy
const createMockReqRes = (options = {}) => {
  const emittedEvents = [];

  const mockIo = {
    to: (room) => ({
      emit: (event, payload) => {
        emittedEvents.push({ room, event, payload });
      }
    }),
    emit: (event, payload) => {
      emittedEvents.push({ room: null, event, payload });
    }
  };

  const req = {
    institutionId: options.institutionId || 1,
    user: options.user || { id: 1, role: 'institution_admin', name: 'Chief Invigilator' },
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    headers: { 'user-agent': 'Phase14-RemoteControlTestRunner' },
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
    app: {
      get: (key) => {
        if (key === 'io') return mockIo;
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

  return { req, res, next, emittedEvents };
};

const runPhase14Tests = async () => {
  console.log('================================================================');
  console.log('🎮 ENTERPRISE ONLINE EXAMINATION - PHASE 14 TEST SUITE');
  console.log('Features: Real-Time Live Remote Control & Proctor Command Intercom');
  console.log('================================================================\n');

  try {
    await sequelize.authenticate();
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA journal_mode = WAL;');
      await sequelize.query('PRAGMA busy_timeout = 25000;');

      // Ensure Phase 14 columns exist on exam_attempts
      try {
        const [attemptColumns] = await sequelize.query('PRAGMA table_info(exam_attempts);');
        const colNames = attemptColumns.map(c => c.name);
        if (!colNames.includes('is_paused')) {
          await sequelize.query('ALTER TABLE exam_attempts ADD COLUMN is_paused BOOLEAN DEFAULT 0;');
        }
        if (!colNames.includes('paused_at')) {
          await sequelize.query('ALTER TABLE exam_attempts ADD COLUMN paused_at DATETIME;');
        }
        if (!colNames.includes('total_paused_seconds')) {
          await sequelize.query('ALTER TABLE exam_attempts ADD COLUMN total_paused_seconds INTEGER DEFAULT 0;');
        }
        if (!colNames.includes('proctor_interventions_count')) {
          await sequelize.query('ALTER TABLE exam_attempts ADD COLUMN proctor_interventions_count INTEGER DEFAULT 0;');
        }
      } catch (colErr) {
        // Table info check
      }
    }
    await sequelize.sync();
    console.log('✓ Database authenticated and schema verified.');

    // 1. Setup Base Institution, Class, Batch & Subject
    let inst = await Institution.findByPk(1);
    if (!inst) inst = await Institution.findOne();

    let cls = await Class.findOne({ where: { institution_id: inst.id } });
    if (!cls) cls = await Class.create({ institution_id: inst.id, name: 'B.Tech CS - Year 4' });

    let batch = await Batch.findOne({ where: { class_id: cls.id } });
    if (!batch) batch = await Batch.create({ class_id: cls.id, name: 'Batch-A' });

    let subject = await Subject.findOne({ where: { institution_id: inst.id } });
    if (!subject) subject = await Subject.create({ institution_id: inst.id, name: 'Distributed Systems', code: 'CS701' });

    const proctorUser = await User.findOne({ where: { institution_id: inst.id, role: 'institution_admin' } }) ||
      await User.create({
        institution_id: inst.id,
        name: 'Chief Proctor Henderson',
        email: `proctor_${Date.now()}@test.edu`,
        password_hash: await bcrypt.hash('ProctorPass123!', 8),
        role: 'institution_admin',
        is_active: true
      });

    // 2. Setup Candidate Student User & Profile
    const studentUser = await User.create({
      institution_id: inst.id,
      name: 'Alex Rivera',
      username: `alex_rivera_${Date.now()}`,
      email: `alex.rivera_${Date.now()}@student.edu`,
      password_hash: await bcrypt.hash('StudentPass123!', 8),
      role: 'student',
      is_active: true
    });

    const student = await Student.create({
      institution_id: inst.id,
      user_id: studentUser.id,
      class_id: cls.id,
      batch_id: batch.id,
      student_id: `STU-REMOTE-${Date.now().toString().slice(-5)}`,
      roll_no: `R-${Date.now().toString().slice(-4)}`
    });

    // 3. Create Exam and Questions
    const exam = await Exam.create({
      institution_id: inst.id,
      title: `Cybersecurity Live Proctored Finals - ${Date.now()}`,
      subject_id: subject.id,
      class_id: cls.id,
      batch_id: batch.id,
      exam_date: new Date().toISOString().split('T')[0],
      start_time: new Date(Date.now() - 30 * 60 * 1000), // started 30 mins ago
      end_time: new Date(Date.now() + 90 * 60 * 1000),   // ends in 90 mins
      duration_minutes: 60,
      total_questions: 2,
      total_marks: 20,
      marks_per_question: 10,
      negative_marking: 2,
      selection_mode: 'manual_fixed',
      status: 'active'
    });

    const q1 = await Question.create({
      institution_id: inst.id,
      subject_id: subject.id,
      question_text: 'What protocol secures real-time WebSocket communication against tampering?',
      question_type: 'single_choice',
      difficulty_level: 'medium',
      marks: 10,
      negative_marks: 2,
      topic: 'Network Security',
      status: 'active'
    });

    await QuestionOption.bulkCreate([
      { question_id: q1.id, option_key: 'A', option_text: 'WSS (WebSocket Secure / TLS)', is_correct: true },
      { question_id: q1.id, option_key: 'B', option_text: 'Telnet Plaintext', is_correct: false },
      { question_id: q1.id, option_key: 'C', option_text: 'FTP Anonymous', is_correct: false },
      { question_id: q1.id, option_key: 'D', option_text: 'HTTP 1.0 Basic', is_correct: false }
    ]);

    const q2 = await Question.create({
      institution_id: inst.id,
      subject_id: subject.id,
      question_text: 'Which architectural component ensures compensatory time calculations during session pauses?',
      question_type: 'single_choice',
      difficulty_level: 'easy',
      marks: 10,
      negative_marks: 2,
      topic: 'Fault Tolerant Design',
      status: 'active'
    });

    await QuestionOption.bulkCreate([
      { question_id: q2.id, option_key: 'A', option_text: 'High-Precision Server Expiry Offsets', is_correct: true },
      { question_id: q2.id, option_key: 'B', option_text: 'Local Client Date.now()', is_correct: false },
      { question_id: q2.id, option_key: 'C', option_text: 'Hardcoded 5-minute constant', is_correct: false },
      { question_id: q2.id, option_key: 'D', option_text: 'Random backoff drift', is_correct: false }
    ]);

    await ExamQuestion.create({ exam_id: exam.id, question_id: q1.id, question_order: 1 });
    await ExamQuestion.create({ exam_id: exam.id, question_id: q2.id, question_order: 2 });
    await ExamAssignment.create({ exam_id: exam.id, student_id: student.id });

    // 4. Create Active In-Progress Attempt
    const now = new Date();
    const initialExpiry = new Date(now.getTime() + 25 * 60 * 1000); // 25 mins remaining
    const attempt = await ExamAttempt.create({
      exam_id: exam.id,
      student_id: student.id,
      start_time: now,
      server_expiry_time: initialExpiry,
      status: 'in_progress',
      is_paused: false,
      total_paused_seconds: 0,
      proctor_interventions_count: 0,
      ip_address: '192.168.1.105',
      user_agent: 'Chrome/124.0 (Windows NT 10.0)'
    });

    // Save answer for Q1
    await StudentAnswer.create({
      exam_attempt_id: attempt.id,
      question_id: q1.id,
      selected_option_key: 'A',
      is_marked_for_review: false,
      answered_at: new Date()
    });

    console.log(`✓ Fixtures created: Exam #${exam.id}, Candidate Alex Rivera (Attempt #${attempt.id})\n`);

    // ================================================================
    // TEST 1: Candidate Time Extension (+10 minutes)
    // ================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 1: Candidate Time Extension (+10 minutes)');
    console.log('----------------------------------------------------------------');
    {
      const { req, res, next, emittedEvents } = createMockReqRes({
        institutionId: inst.id,
        user: proctorUser,
        params: { attemptId: attempt.id },
        body: { minutes: 10, reason: 'Approved accommodation for intermittent network fluctuation.' }
      });

      await extendCandidateTime(req, res, next);

      if (res.statusCode !== 200 || !res.data?.success) {
        throw new Error(`Expected 200 success, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
      }

      await attempt.reload();
      const updatedExpiryMs = new Date(attempt.server_expiry_time).getTime();
      const expectedExpiryMs = initialExpiry.getTime() + 10 * 60 * 1000;
      const expiryDifferenceSec = Math.abs(updatedExpiryMs - expectedExpiryMs) / 1000;

      if (expiryDifferenceSec > 2) {
        throw new Error(`Expiry calculation mismatch! Expected ~${expectedExpiryMs}, got ${updatedExpiryMs}`);
      }

      if (attempt.proctor_interventions_count !== 1) {
        throw new Error(`Interventions count expected 1, got ${attempt.proctor_interventions_count}`);
      }

      // Verify Socket Broadcast
      const extensionSocket = emittedEvents.find(e => e.event === 'exam_time_extended');
      if (!extensionSocket) {
        throw new Error('Socket.IO did not emit "exam_time_extended" event!');
      }
      if (extensionSocket.payload.extraMinutes !== 10 || extensionSocket.payload.attemptId !== attempt.id) {
        throw new Error(`Socket payload mismatch: ${JSON.stringify(extensionSocket.payload)}`);
      }

      // Verify Audit Trail
      const audit = await AuditLog.findOne({
        where: { action: 'PROCTOR_TIME_EXTENSION', entity_id: attempt.id }
      });
      if (!audit) {
        throw new Error('Audit log for PROCTOR_TIME_EXTENSION was not found!');
      }

      console.log(`✓ Time extension granted: +10m added (New Expiry: ${attempt.server_expiry_time.toISOString()})`);
      console.log(`✓ Socket broadcast confirmed on room "${extensionSocket.room}" with extraMinutes: 10`);
      console.log(`✓ Audit log verified: #${audit.id} by ${proctorUser.name}\n`);
    }

    // ================================================================
    // TEST 2: Remote Session Pause (Lock Candidate Screen)
    // ================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 2: Remote Session Pause');
    console.log('----------------------------------------------------------------');
    {
      const { req, res, next, emittedEvents } = createMockReqRes({
        institutionId: inst.id,
        user: proctorUser,
        params: { attemptId: attempt.id },
        body: { reason: 'Proctor verification of dual-monitor anomaly.' }
      });

      await pauseCandidateAttempt(req, res, next);

      if (res.statusCode !== 200 || !res.data?.success) {
        throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
      }

      await attempt.reload();
      if (!attempt.is_paused || !attempt.paused_at) {
        throw new Error('Attempt failed to enter paused state!');
      }
      if (attempt.proctor_interventions_count !== 2) {
        throw new Error(`Interventions count expected 2, got ${attempt.proctor_interventions_count}`);
      }

      const pauseSocket = emittedEvents.find(e => e.event === 'exam_paused');
      if (!pauseSocket) {
        throw new Error('Socket.IO did not emit "exam_paused" event!');
      }

      console.log(`✓ Candidate session successfully paused at ${attempt.paused_at.toISOString()}`);
      console.log(`✓ Socket broadcast confirmed for room "${pauseSocket.room}": ${pauseSocket.payload.reason}\n`);
    }

    // ================================================================
    // TEST 3: Remote Session Resumption & Compensatory Time Adjustment
    // ================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 3: Remote Session Resumption & Zero-Loss Compensatory Time');
    console.log('----------------------------------------------------------------');
    {
      // Simulate that the session was paused for exactly 90 seconds
      const simulatedPauseStart = new Date(Date.now() - 90 * 1000);
      attempt.paused_at = simulatedPauseStart;
      await attempt.save();

      const preResumeExpiry = new Date(attempt.server_expiry_time).getTime();

      const { req, res, next, emittedEvents } = createMockReqRes({
        institutionId: inst.id,
        user: proctorUser,
        params: { attemptId: attempt.id },
        body: { notes: 'Dual-monitor check resolved; second screen disconnected.' }
      });

      await resumeCandidateAttempt(req, res, next);

      if (res.statusCode !== 200 || !res.data?.success) {
        throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
      }

      await attempt.reload();
      if (attempt.is_paused || attempt.paused_at !== null) {
        throw new Error('Attempt is still marked as paused after resumption!');
      }

      const postResumeExpiry = new Date(attempt.server_expiry_time).getTime();
      const compensatoryDeltaSec = Math.round((postResumeExpiry - preResumeExpiry) / 1000);

      if (compensatoryDeltaSec < 88 || compensatoryDeltaSec > 95) {
        throw new Error(`Compensatory time mismatch! Expected ~90s, got ${compensatoryDeltaSec}s`);
      }

      if (attempt.total_paused_seconds < 88) {
        throw new Error(`total_paused_seconds not accumulated correctly: ${attempt.total_paused_seconds}`);
      }

      const resumeSocket = emittedEvents.find(e => e.event === 'exam_resumed');
      if (!resumeSocket) {
        throw new Error('Socket.IO did not emit "exam_resumed" event!');
      }

      console.log(`✓ Session resumed: +${compensatoryDeltaSec}s exact compensatory time credited to student timer.`);
      console.log(`✓ Total recorded paused duration: ${attempt.total_paused_seconds}s`);
      console.log(`✓ Socket broadcast confirmed: ${resumeSocket.payload.notes}\n`);
    }

    // ================================================================
    // TEST 4: Direct Candidate Intercom Warning Dispatch
    // ================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 4: Direct Candidate Intercom Warning Dispatch');
    console.log('----------------------------------------------------------------');
    {
      const warningMsg = 'Please ensure your web camera is positioned directly in front of you.';
      const { req, res, next, emittedEvents } = createMockReqRes({
        institutionId: inst.id,
        user: proctorUser,
        params: { attemptId: attempt.id },
        body: { message: warningMsg, severity: 'warning' }
      });

      await sendCandidateWarning(req, res, next);

      if (res.statusCode !== 200 || !res.data?.success) {
        throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
      }

      await attempt.reload();
      if (attempt.proctor_interventions_count < 3) {
        throw new Error(`Expected proctor_interventions_count >= 3, got ${attempt.proctor_interventions_count}`);
      }

      const warningSocket = emittedEvents.find(e => e.event === 'proctor_warning_alert');
      if (!warningSocket) {
        throw new Error('Socket.IO did not emit "proctor_warning_alert" event!');
      }
      if (warningSocket.payload.message !== warningMsg || warningSocket.payload.severity !== 'warning') {
        throw new Error(`Warning socket payload mismatch: ${JSON.stringify(warningSocket.payload)}`);
      }

      const warningAudit = await AuditLog.findOne({
        where: { action: 'PROCTOR_WARNING_DISPATCHED', entity_id: attempt.id }
      });
      if (!warningAudit) {
        throw new Error('Audit log for PROCTOR_WARNING_DISPATCHED was not found!');
      }

      console.log(`✓ Direct warning alert dispatched to ${attempt.student_id}`);
      console.log(`✓ Severity: [${warningSocket.payload.severity.toUpperCase()}]`);
      console.log(`✓ Audit log verified: #${warningAudit.id}\n`);
    }

    // ================================================================
    // TEST 5: Cohort-Wide Room Announcement Broadcast
    // ================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 5: Cohort-Wide Room Announcement Broadcast');
    console.log('----------------------------------------------------------------');
    {
      const broadcastMsg = 'Attention all candidates: 20 minutes remaining. Verify all marked-for-review answers.';
      const { req, res, next, emittedEvents } = createMockReqRes({
        institutionId: inst.id,
        user: proctorUser,
        params: { examId: exam.id },
        body: { message: broadcastMsg, priority: 'urgent' }
      });

      await broadcastExamAnnouncement(req, res, next);

      if (res.statusCode !== 200 || !res.data?.success) {
        throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
      }

      const broadcastSocket = emittedEvents.find(e => e.event === 'cohort_announcement');
      if (!broadcastSocket) {
        throw new Error('Socket.IO did not emit "cohort_announcement" event!');
      }
      if (broadcastSocket.room !== `exam_${exam.id}`) {
        throw new Error(`Expected broadcast room "exam_${exam.id}", got "${broadcastSocket.room}"`);
      }
      if (broadcastSocket.payload.priority !== 'urgent') {
        throw new Error(`Expected priority "urgent", got "${broadcastSocket.payload.priority}"`);
      }

      const broadcastAudit = await AuditLog.findOne({
        where: { action: 'PROCTOR_COHORT_BROADCAST', entity_id: exam.id }
      });
      if (!broadcastAudit) {
        throw new Error('Audit log for PROCTOR_COHORT_BROADCAST was not found!');
      }

      console.log(`✓ Cohort broadcast sent to room "exam_${exam.id}"`);
      console.log(`✓ Priority: [${broadcastSocket.payload.priority.toUpperCase()}]`);
      console.log(`✓ Message: "${broadcastMsg}"\n`);
    }

    // ================================================================
    // TEST 6: Remote Force Submit & Immediate Grading
    // ================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 6: Remote Force Submit & Immediate Grading');
    console.log('----------------------------------------------------------------');
    {
      const { req, res, next, emittedEvents } = createMockReqRes({
        institutionId: inst.id,
        user: proctorUser,
        params: { attemptId: attempt.id },
        body: { reason: 'Conduct review violation: persistent unpermitted screen share.' }
      });

      await forceSubmitAttempt(req, res, next);

      if (res.statusCode !== 200 || !res.data?.success) {
        throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
      }

      await attempt.reload();
      if (attempt.status !== 'auto_submitted') {
        throw new Error(`Expected attempt status "auto_submitted", got "${attempt.status}"`);
      }

      // Check that ExamResult was calculated and stored
      const result = await ExamResult.findOne({
        where: { exam_attempt_id: attempt.id }
      });
      if (!result) {
        throw new Error('ExamResult record was not created during force submission!');
      }

      if (parseFloat(result.total_marks_obtained) !== 10) {
        throw new Error(`Expected total_marks_obtained 10 (Q1 correct), got ${result.total_marks_obtained}`);
      }

      const forceSocket = emittedEvents.find(e => e.event === 'exam_force_submitted');
      if (!forceSocket) {
        throw new Error('Socket.IO did not emit "exam_force_submitted" event!');
      }

      const forceAudit = await AuditLog.findOne({
        where: { action: 'PROCTOR_FORCE_SUBMISSION', entity_id: attempt.id }
      });
      if (!forceAudit) {
        throw new Error('Audit log for PROCTOR_FORCE_SUBMISSION was not found!');
      }

      console.log(`✓ Candidate attempt #${attempt.id} forcefully terminated and evaluated.`);
      console.log(`✓ Final Score: ${result.total_marks_obtained} / ${result.max_marks} (${result.percentage}%)`);
      console.log(`✓ Socket broadcast confirmed: "exam_force_submitted" for ${attempt.student_id}\n`);
    }

    // ================================================================
    // TEST 7: Live Monitor Telemetry Feed & State Verification
    // ================================================================
    console.log('----------------------------------------------------------------');
    console.log('TEST 7: Live Monitor Telemetry Feed & State Verification');
    console.log('----------------------------------------------------------------');
    {
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        user: proctorUser,
        params: { examId: exam.id }
      });

      await getLiveExamStatus(req, res, next);

      if (res.statusCode !== 200 || !res.data?.success) {
        throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
      }

      const { counters, exam: examData, recentEvents } = res.data;
      if (counters.assigned !== 1) {
        throw new Error(`Expected assigned: 1, got ${counters.assigned}`);
      }
      if (counters.autoSubmitted !== 1) {
        throw new Error(`Expected autoSubmitted: 1, got ${counters.autoSubmitted}`);
      }
      if (!recentEvents || recentEvents.length === 0) {
        throw new Error('Recent telemetry events feed should contain audit records!');
      }

      console.log(`✓ Live Monitor Telemetry retrieved successfully for Exam #${examData.id}:`);
      console.log(`  - Assigned Candidates: ${counters.assigned}`);
      console.log(`  - Auto-Submitted (Terminated): ${counters.autoSubmitted}`);
      console.log(`  - Telemetry Events Tracked: ${recentEvents.length}`);
      console.log(`  - Recent Event Action: "${recentEvents[0].action}"\n`);
    }

    console.log('================================================================');
    console.log('🎉 ALL 7 PHASE 14 TESTS PASSED FLAWLESSLY!');
    console.log('================================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ PHASE 14 TEST SUITE FAILED:', error);
    process.exit(1);
  }
};

runPhase14Tests();
