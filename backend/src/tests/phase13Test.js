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
  QuestionChallenge,
  AuditLog
} = require('../models');

const {
  submitChallenge,
  getMyChallenges,
  getExamChallenges,
  resolveQuestionChallenges,
  regradeExamCohort
} = require('../controllers/challengeController');

// Helper to mock Express req, res, next
const createMockReqRes = (options = {}) => {
  const req = {
    institutionId: options.institutionId || 1,
    user: options.user || { id: 1, role: 'institution_admin', name: 'Academic Dean' },
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    headers: { 'user-agent': 'Phase13-KeyChallengeTestRunner' },
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

const runPhase13Tests = async () => {
  console.log('================================================================');
  console.log('⚖️ ENTERPRISE ONLINE EXAMINATION - PHASE 13 TEST SUITE');
  console.log('Features: Candidate Key Challenge, Grievance Redressal & Cohort Re-grading');
  console.log('================================================================\n');

  try {
    await sequelize.authenticate();
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA journal_mode = WAL;');
      await sequelize.query('PRAGMA busy_timeout = 25000;');
    }
    await sequelize.sync();
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
        name: 'Batch 2026-P13',
        start_year: 2023,
        end_year: 2027
      });
    }

    let subject = await Subject.findOne({ where: { institution_id: inst.id } });
    if (!subject) {
      subject = await Subject.create({
        institution_id: inst.id,
        code: 'CS402',
        name: 'Advanced Algorithms & Complexity'
      });
    }

    // 2. Setup Test Exam with 2 Questions
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
      title: 'Competitive Algorithmic Benchmark 2026',
      duration_minutes: 60,
      total_questions: 2,
      total_marks: 20,
      marks_per_question: 10,
      negative_marking: 2.5,
      selection_mode: 'manual_fixed',
      status: 'published'
    });
    console.log(`✓ Setup test exam [ID: ${testExam.id}] "${testExam.title}"`);

    // Create Question 1: Official Key is B (Initially), Candidate argues C is correct
    const q1 = await Question.create({
      institution_id: inst.id,
      subject_id: subject.id,
      question_text: 'What is the tightest worst-case time complexity of QuickSelect with median-of-medians?',
      difficulty_level: 'medium',
      marks: 10,
      negative_marks: 2.5,
      is_verified: true,
      status: 'active'
    });

    await QuestionOption.bulkCreate([
      { question_id: q1.id, option_key: 'A', option_text: 'O(n^2)', is_correct: false },
      { question_id: q1.id, option_key: 'B', option_text: 'O(n log n)', is_correct: true }, // Initial flawed key
      { question_id: q1.id, option_key: 'C', option_text: 'O(n)', is_correct: false }, // Academically correct key
      { question_id: q1.id, option_key: 'D', option_text: 'O(log n)', is_correct: false }
    ]);

    // Create Question 2: Defective question that will receive BONUS_MARKS
    const q2 = await Question.create({
      institution_id: inst.id,
      subject_id: subject.id,
      question_text: 'Which of the following sorting algorithms is unstable? (Ambiguous statement with defective distractors)',
      difficulty_level: 'hard',
      marks: 10,
      negative_marks: 2.5,
      is_verified: true,
      status: 'active'
    });

    await QuestionOption.bulkCreate([
      { question_id: q2.id, option_key: 'A', option_text: 'QuickSort', is_correct: true },
      { question_id: q2.id, option_key: 'B', option_text: 'HeapSort', is_correct: false },
      { question_id: q2.id, option_key: 'C', option_text: 'SelectionSort', is_correct: false },
      { question_id: q2.id, option_key: 'D', option_text: 'MergeSort', is_correct: false }
    ]);

    await ExamQuestion.bulkCreate([
      { exam_id: testExam.id, question_id: q1.id, question_order: 1 },
      { exam_id: testExam.id, question_id: q2.id, question_order: 2 }
    ]);

    // 3. Create Candidate 1 (Alice):
    // Answered Q1 -> C (originally wrong under key B: -2.5 marks)
    // Answered Q2 -> D (originally wrong: -2.5 marks)
    // Initial score = 0 (clamped from -5.0)
    const passwordHash = await bcrypt.hash('CandidatePass1!', 8);
    const userAlice = await User.create({
      institution_id: inst.id,
      name: 'Alice Challenger',
      email: `alice_${Date.now()}@university.edu`,
      username: `alice_${Date.now()}`,
      password_hash: passwordHash,
      role: 'student'
    });
    const studentAlice = await Student.create({
      institution_id: inst.id,
      user_id: userAlice.id,
      class_id: cls.id,
      batch_id: batch.id,
      student_id: `STU-A-${Date.now().toString().slice(-4)}`,
      roll_no: `ROLL-A-${Math.floor(Math.random() * 8999 + 1000)}`,
      is_active: true
    });

    const attemptAlice = await ExamAttempt.create({
      institution_id: inst.id,
      exam_id: testExam.id,
      student_id: studentAlice.id,
      attempt_number: 1,
      start_time: new Date(),
      end_time: new Date(),
      server_expiry_time: new Date(Date.now() + 3600000),
      status: 'submitted',
      ip_address: '10.0.0.1'
    });

    await StudentAnswer.bulkCreate([
      { exam_attempt_id: attemptAlice.id, question_id: q1.id, selected_option_key: 'C', is_correct: false, marks_awarded: -2.5 },
      { exam_attempt_id: attemptAlice.id, question_id: q2.id, selected_option_key: 'D', is_correct: false, marks_awarded: -2.5 }
    ]);

    const resultAlice = await ExamResult.create({
      institution_id: inst.id,
      exam_id: testExam.id,
      student_id: studentAlice.id,
      exam_attempt_id: attemptAlice.id,
      total_questions: 2,
      attempted_questions: 2,
      correct_answers: 0,
      wrong_answers: 2,
      unattempted_questions: 0,
      total_marks_obtained: 0,
      max_marks: 20,
      percentage: 0,
      is_passed: false,
      rank: 2,
      completion_time_seconds: 1200
    });

    // 4. Create Candidate 2 (Bob):
    // Answered Q1 -> B (originally correct under key B: +10 marks)
    // Answered Q2 -> A (originally correct: +10 marks)
    // Initial score = 20 / 20 (Rank 1)
    const userBob = await User.create({
      institution_id: inst.id,
      name: 'Bob Beneficiary',
      email: `bob_${Date.now()}@university.edu`,
      username: `bob_${Date.now()}`,
      password_hash: passwordHash,
      role: 'student'
    });
    const studentBob = await Student.create({
      institution_id: inst.id,
      user_id: userBob.id,
      class_id: cls.id,
      batch_id: batch.id,
      student_id: `STU-B-${Date.now().toString().slice(-4)}`,
      roll_no: `ROLL-B-${Math.floor(Math.random() * 8999 + 1000)}`,
      is_active: true
    });

    const attemptBob = await ExamAttempt.create({
      institution_id: inst.id,
      exam_id: testExam.id,
      student_id: studentBob.id,
      attempt_number: 1,
      start_time: new Date(),
      end_time: new Date(),
      server_expiry_time: new Date(Date.now() + 3600000),
      status: 'submitted',
      ip_address: '10.0.0.2'
    });

    await StudentAnswer.bulkCreate([
      { exam_attempt_id: attemptBob.id, question_id: q1.id, selected_option_key: 'B', is_correct: true, marks_awarded: 10 },
      { exam_attempt_id: attemptBob.id, question_id: q2.id, selected_option_key: 'A', is_correct: true, marks_awarded: 10 }
    ]);

    const resultBob = await ExamResult.create({
      institution_id: inst.id,
      exam_id: testExam.id,
      student_id: studentBob.id,
      exam_attempt_id: attemptBob.id,
      total_questions: 2,
      attempted_questions: 2,
      correct_answers: 2,
      wrong_answers: 0,
      unattempted_questions: 0,
      total_marks_obtained: 20,
      max_marks: 20,
      percentage: 100,
      is_passed: true,
      rank: 1,
      completion_time_seconds: 1500
    });

    // -----------------------------------------------------------------
    // TEST 1: Candidate Challenge Submission
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: Candidate Answer Key Challenge Submission ---');
    {
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        user: { id: userAlice.id, role: 'student', name: userAlice.name },
        body: {
          exam_id: testExam.id,
          question_id: q1.id,
          exam_attempt_id: attemptAlice.id,
          challenge_type: 'WRONG_KEY',
          claimed_option_key: 'C',
          justification: 'According to Cormen (CLRS) Chapter 9, median-of-medians guarantees worst-case linear time O(n), not O(n log n).',
          reference_source: 'Introduction to Algorithms (CLRS 3rd Ed), Section 9.3, Page 220.'
        }
      });

      await submitChallenge(req, res, next);
      if (res.statusCode !== 201 || !res.data.success) {
        throw new Error(`Submit challenge failed with status ${res.statusCode}: ${JSON.stringify(res.data)}`);
      }

      const challenge = res.data.challenge;
      if (challenge.status !== 'pending' || challenge.claimed_option_key !== 'C') {
        throw new Error(`Unexpected challenge state: ${JSON.stringify(challenge)}`);
      }

      console.log('✓ Candidate challenge lodged successfully for Q1 with claimed key "C".');

      // Duplicate submission test (must be blocked)
      const { req: dupReq, res: dupRes, next: dupNext } = createMockReqRes({
        institutionId: inst.id,
        user: { id: userAlice.id, role: 'student', name: userAlice.name },
        body: {
          exam_id: testExam.id,
          question_id: q1.id,
          exam_attempt_id: attemptAlice.id,
          challenge_type: 'WRONG_KEY',
          claimed_option_key: 'C',
          justification: 'Submitting duplicate.'
        }
      });

      await submitChallenge(dupReq, dupRes, dupNext);
      if (dupRes.statusCode !== 400 || dupRes.data.success !== false) {
        throw new Error('Duplicate challenge was not blocked!');
      }
      console.log('✓ Duplicate dispute submission prevention verified (HTTP 400).');
    }

    // -----------------------------------------------------------------
    // TEST 2: Candidate Challenge History Retrieval
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Retrieve Candidate Challenge History ---');
    {
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        user: { id: userAlice.id, role: 'student', name: userAlice.name },
        query: { examId: testExam.id }
      });

      await getMyChallenges(req, res, next);
      if (res.statusCode !== 200 || !res.data.success) {
        throw new Error(`Failed to retrieve candidate challenges: ${JSON.stringify(res.data)}`);
      }

      if (res.data.challenges.length !== 1) {
        throw new Error(`Expected 1 challenge in history, found ${res.data.challenges.length}`);
      }

      console.log(`✓ Candidate challenge history verified: 1 challenge found for exam "${testExam.title}".`);
    }

    // -----------------------------------------------------------------
    // TEST 3: Admin Review & Question Grouping Aggregations
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Admin Dispute Review & Question Grouping ---');
    {
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        user: { id: 1, role: 'institution_admin', name: 'Chief Academic Officer' },
        params: { examId: testExam.id }
      });

      await getExamChallenges(req, res, next);
      if (res.statusCode !== 200 || !res.data.success) {
        throw new Error(`Failed to get exam challenges: ${JSON.stringify(res.data)}`);
      }

      const { stats, disputedQuestions } = res.data;
      if (stats.totalChallenges !== 1 || stats.uniqueQuestionsDisputed !== 1) {
        throw new Error(`Stats mismatch: ${JSON.stringify(stats)}`);
      }

      const disputedQ1 = disputedQuestions[0];
      if (disputedQ1.questionId !== q1.id || disputedQ1.totalChallenges !== 1) {
        throw new Error(`Question grouping mismatch: ${JSON.stringify(disputedQ1)}`);
      }
      if (disputedQ1.claimedKeyCounts['C'] !== 1) {
        throw new Error(`Expected claimedKeyCounts['C'] to be 1`);
      }

      console.log(`✓ Admin review console verified: ${stats.totalChallenges} challenge grouped under Question #${q1.id}.`);
      console.log(`✓ Claim breakdown verified: Key "C" claimed by 1 candidate.`);
    }

    // -----------------------------------------------------------------
    // TEST 4: KEY_CHANGE Resolution & Automated Cohort Re-grading
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: KEY_CHANGE Resolution & Cohort Re-grading Engine ---');
    {
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        user: { id: 1, role: 'institution_admin', name: 'Academic Dean' },
        params: { examId: testExam.id, questionId: q1.id },
        body: {
          resolution_action: 'KEY_CHANGE',
          new_correct_option_key: 'C',
          notes: 'Academic committee reviewed CLRS reference: QuickSelect with median-of-medians is strictly O(n). Answer key revised to C.'
        }
      });

      await resolveQuestionChallenges(req, res, next);
      if (res.statusCode !== 200 || !res.data.success) {
        throw new Error(`Resolve challenges failed: ${JSON.stringify(res.data)}`);
      }

      const regradeSummary = res.data.regradeSummary;
      if (regradeSummary.candidatesRegraded !== 2) {
        throw new Error(`Expected 2 candidates regraded, got ${regradeSummary.candidatesRegraded}`);
      }

      // Verify QuestionOption update
      const optionsQ1 = await QuestionOption.findAll({ where: { question_id: q1.id } });
      const optC = optionsQ1.find(o => o.option_key === 'C');
      const optB = optionsQ1.find(o => o.option_key === 'B');
      if (!optC.is_correct || optB.is_correct) {
        throw new Error('QuestionOption correct status was not updated properly!');
      }
      console.log('✓ QuestionOption key successfully revised: Option C is now correct.');

      // Verify Alice's result: Q1 now correct (+10), Q2 wrong (-2.5) -> Net score = 7.5
      const updatedResultAlice = await ExamResult.findOne({ where: { exam_attempt_id: attemptAlice.id } });
      if (parseFloat(updatedResultAlice.total_marks_obtained) !== 7.5) {
        throw new Error(`Expected Alice's marks to become 7.5, got ${updatedResultAlice.total_marks_obtained}`);
      }
      console.log(`✓ Alice's score increased from 0 to ${updatedResultAlice.total_marks_obtained} marks (+7.5).`);

      // Verify Bob's result: Q1 now wrong (-2.5), Q2 correct (+10) -> Net score = 7.5
      const updatedResultBob = await ExamResult.findOne({ where: { exam_attempt_id: attemptBob.id } });
      if (parseFloat(updatedResultBob.total_marks_obtained) !== 7.5) {
        throw new Error(`Expected Bob's marks to become 7.5, got ${updatedResultBob.total_marks_obtained}`);
      }
      console.log(`✓ Bob's score decreased from 20 to ${updatedResultBob.total_marks_obtained} marks (-12.5).`);

      // Verify tie-breaker ranking: Alice finished in 1200s, Bob in 1500s. Alice gets Rank 1!
      if (updatedResultAlice.rank !== 1 || updatedResultBob.rank !== 2) {
        throw new Error(`Tie-breaker rank error: Alice rank=${updatedResultAlice.rank}, Bob rank=${updatedResultBob.rank}`);
      }
      console.log('✓ Cohort tie-breaker verified: Alice (1200s) ranked #1 over Bob (1500s) on identical scores.');

      // Verify challenge status updated to 'accepted'
      const updatedChallenge = await QuestionChallenge.findOne({ where: { exam_id: testExam.id, question_id: q1.id } });
      if (updatedChallenge.status !== 'accepted' || updatedChallenge.resolution_action !== 'KEY_CHANGE') {
        throw new Error(`Challenge state mismatch: ${updatedChallenge.status}`);
      }
      console.log('✓ Challenge record transitioned to status "accepted".');
    }

    // -----------------------------------------------------------------
    // TEST 5: BONUS_MARKS Resolution & Automated Cohort Re-grading
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: BONUS_MARKS Award & Second Cohort Re-grading ---');
    {
      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        user: { id: 1, role: 'institution_admin', name: 'Academic Dean' },
        params: { examId: testExam.id, questionId: q2.id },
        body: {
          resolution_action: 'BONUS_MARKS',
          notes: 'Question 2 contains ambiguous wording regarding sorting stability. Full bonus (+10 marks) awarded to all candidates.'
        }
      });

      await resolveQuestionChallenges(req, res, next);
      if (res.statusCode !== 200 || !res.data.success) {
        throw new Error(`Bonus marks resolution failed: ${JSON.stringify(res.data)}`);
      }

      // Check results after bonus:
      // Alice: Q1 correct (+10), Q2 bonus (+10) -> Total = 20 / 20 marks!
      const finalResultAlice = await ExamResult.findOne({ where: { exam_attempt_id: attemptAlice.id } });
      if (parseFloat(finalResultAlice.total_marks_obtained) !== 20) {
        throw new Error(`Expected Alice's final score to be 20 with bonus, got ${finalResultAlice.total_marks_obtained}`);
      }
      console.log(`✓ Alice final score after Q2 bonus marks: ${finalResultAlice.total_marks_obtained} / 20 (100% Pass).`);

      // Bob: Q1 wrong (-2.5), Q2 bonus (+10) -> Total = 7.5 / 20 marks!
      const finalResultBob = await ExamResult.findOne({ where: { exam_attempt_id: attemptBob.id } });
      console.log(`✓ Bob final score after Q2 bonus marks: ${finalResultBob.total_marks_obtained} / 20.`);
    }

    // -----------------------------------------------------------------
    // TEST 6: REJECT Dispute Action
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Dispute Rejection Action ---');
    {
      // Create a 3rd challenge for testExam
      const testChallenge3 = await QuestionChallenge.create({
        institution_id: inst.id,
        exam_id: testExam.id,
        question_id: q1.id,
        student_id: studentBob.id,
        exam_attempt_id: attemptBob.id,
        challenge_type: 'OUT_OF_SYLLABUS',
        justification: 'Claiming QuickSelect is out of syllabus.',
        status: 'pending'
      });

      const { req, res, next } = createMockReqRes({
        institutionId: inst.id,
        user: { id: 1, role: 'institution_admin', name: 'Academic Dean' },
        params: { examId: testExam.id, questionId: q1.id },
        body: {
          resolution_action: 'REJECT',
          notes: 'Syllabus Section 4.2 explicitly covers Order Statistics and Selection Algorithms.'
        }
      });

      await resolveQuestionChallenges(req, res, next);
      if (res.statusCode !== 200 || !res.data.success) {
        throw new Error(`Reject dispute failed: ${JSON.stringify(res.data)}`);
      }

      await testChallenge3.reload();
      if (testChallenge3.status !== 'rejected') {
        throw new Error(`Expected challenge to be rejected, got ${testChallenge3.status}`);
      }
      console.log('✓ Dispute rejection verified: Status transitioned to "rejected" with official committee rationale.');
    }

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 13 AUTOMATED TESTS PASSED SUCCESSFULLY (6/6)');
    console.log('================================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ PHASE 13 TEST SUITE FAILED:', error);
    process.exit(1);
  }
};

runPhase13Tests();
