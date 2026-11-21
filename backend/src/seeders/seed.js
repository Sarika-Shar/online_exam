require('dotenv').config();
const {
  sequelize,
  Institution,
  User,
  Class,
  Subject,
  Batch,
  Student,
  QuestionBank,
  Question,
  QuestionOption,
  Exam,
  ExamQuestion,
  ExamAssignment,
  AuditLog
} = require('../models');
const logger = require('../utils/logger');

const runSeeder = async (shouldExit = false, wipe = true) => {
  try {
    logger.info('Starting Database Seeder...');
    if (wipe) {
      await sequelize.sync({ force: true });
      logger.info('Database tables wiped and recreated cleanly.');
    } else {
      await sequelize.sync({ alter: false });
    }

    // 1. Create Institutions
    const apex = await Institution.create({
      name: 'Apex International University',
      code: 'APEX_UNIV',
      email: 'contact@apex.edu',
      phone: '+1-555-0199',
      address: '742 Evergreen Terrace, Springfield',
      logo_url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=120&h=120&fit=crop&q=80',
      is_active: true,
      settings: {
        currency: 'USD',
        certificate_auto_generate: true,
        tie_breaker_rule: 'HIGHEST_MARKS_EARLIEST_SUBMISSION'
      }
    });

    const gta = await Institution.create({
      name: 'Global Tech Academy',
      code: 'GTA_TECH',
      email: 'admissions@gta.edu',
      phone: '+1-555-0244',
      address: '100 Innovation Way, Silicon Valley',
      logo_url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=120&h=120&fit=crop&q=80',
      is_active: true,
      settings: {
        currency: 'USD',
        certificate_auto_generate: true,
        tie_breaker_rule: 'HIGHEST_MARKS_EARLIEST_SUBMISSION'
      }
    });

    // 2. Create Users across roles
    // Super Admin (No institution restriction)
    const superAdmin = await User.create({
      name: 'Sarbit Infotech (SuperAdmin)',
      email: 'superadmin@onlineexam.com',
      username: 'superadmin',
      password_hash: 'SuperAdmin@123',
      role: 'super_admin',
      phone: '+1-555-9000',
      is_active: true
    });

    // Institution Admin for Apex
    const apexAdmin = await User.create({
      institution_id: apex.id,
      name: 'Prof. Bittoo Sharma (Admin)',
      email: 'admin@apex.edu',
      username: 'apex_admin',
      password_hash: 'Admin@123',
      role: 'institution_admin',
      phone: '+1-555-9001',
      is_active: true
    });

    // Teacher for Apex
    const apexTeacher = await User.create({
      institution_id: apex.id,
      name: 'Sanjay (CSE Faculty)',
      email: 'teacher@apex.edu',
      username: 'apex_teacher',
      password_hash: 'Teacher@123',
      role: 'teacher',
      phone: '+1-555-9002',
      is_active: true
    });

    // 3. Create Classes, Subjects & Batches for Apex
    const cseClass = await Class.create({
      institution_id: apex.id,
      name: 'B.Tech Computer Science & Engineering',
      code: 'BTECH-CSE',
      description: 'Undergraduate engineering program in computing',
      is_active: true
    });

    const bbaClass = await Class.create({
      institution_id: apex.id,
      name: 'Bachelor of Business Administration',
      code: 'BBA-MGMT',
      description: 'Undergraduate business management program',
      is_active: true
    });

    const dsaSubject = await Subject.create({
      institution_id: apex.id,
      class_id: cseClass.id,
      name: 'Data Structures and Algorithms',
      code: 'CS-301',
      description: 'Core concepts of algorithmic complexity, trees, graphs, and dynamic programming'
    });

    const dbmsSubject = await Subject.create({
      institution_id: apex.id,
      class_id: cseClass.id,
      name: 'Database Management Systems',
      code: 'CS-302',
      description: 'Relational algebra, SQL, normalization, transactions, and indexing'
    });

    const batch2026A = await Batch.create({
      institution_id: apex.id,
      class_id: cseClass.id,
      name: 'CSE Batch 2026-A (Morning)',
      code: 'CSE-2026-A',
      start_year: 2022,
      end_year: 2026
    });

    const batch2026B = await Batch.create({
      institution_id: apex.id,
      class_id: cseClass.id,
      name: 'CSE Batch 2026-B (Afternoon)',
      code: 'CSE-2026-B',
      start_year: 2022,
      end_year: 2026
    });

    // 4. Create Students for Apex
    const studentUsersData = [
      { name: 'Alex Johnson', email: 'student1@apex.edu', username: 'student1', studentId: 'APEX-2026-001', roll: '101' },
      { name: 'Priya Sharma', email: 'student2@apex.edu', username: 'student2', studentId: 'APEX-2026-002', roll: '102' },
      { name: 'David Lee', email: 'student3@apex.edu', username: 'student3', studentId: 'APEX-2026-003', roll: '103' },
      { name: 'Sophia Martinez', email: 'student4@apex.edu', username: 'student4', studentId: 'APEX-2026-004', roll: '104' },
      { name: 'Rohan Patel', email: 'student5@apex.edu', username: 'student5', studentId: 'APEX-2026-005', roll: '105' }
    ];

    for (const data of studentUsersData) {
      const u = await User.create({
        institution_id: apex.id,
        name: data.name,
        email: data.email,
        username: data.username,
        password_hash: 'Student@123',
        role: 'student',
        phone: '+1-555-8888',
        is_active: true
      });

      await Student.create({
        institution_id: apex.id,
        user_id: u.id,
        student_id: data.studentId,
        class_id: cseClass.id,
        batch_id: batch2026A.id,
        roll_no: data.roll,
        enrollment_no: `ENR-${data.studentId}`,
        gender: 'other',
        is_active: true
      });
    }

    // 5. Create Question Bank & Sample Questions
    const qb = await QuestionBank.create({
      institution_id: apex.id,
      subject_id: dsaSubject.id,
      name: 'DSA Midterm Master Question Pool',
      description: 'Comprehensive question set for evaluation',
      is_active: true
    });

    const sampleQuestions = [
      {
        text: 'What is the worst-case time complexity of QuickSort?',
        topic: 'Sorting Algorithms',
        difficulty: 'medium',
        options: [
          { key: 'A', text: 'O(n log n)', is_correct: false },
          { key: 'B', text: 'O(n²)', is_correct: true },
          { key: 'C', text: 'O(n)', is_correct: false },
          { key: 'D', text: 'O(log n)', is_correct: false }
        ]
      },
      {
        text: 'Which data structure follows the LIFO (Last In First Out) principle?',
        topic: 'Linear Data Structures',
        difficulty: 'easy',
        options: [
          { key: 'A', text: 'Queue', is_correct: false },
          { key: 'B', text: 'Stack', is_correct: true },
          { key: 'C', text: 'Linked List', is_correct: false },
          { key: 'D', text: 'Binary Tree', is_correct: false }
        ]
      },
      {
        text: 'In relational databases, which normal form eliminates transitive dependency?',
        topic: 'Normalization',
        difficulty: 'hard',
        options: [
          { key: 'A', text: '1NF', is_correct: false },
          { key: 'B', text: '2NF', is_correct: false },
          { key: 'C', text: '3NF', is_correct: true },
          { key: 'D', text: 'BCNF', is_correct: false }
        ]
      }
    ];

    for (const q of sampleQuestions) {
      const createdQ = await Question.create({
        institution_id: apex.id,
        question_bank_id: qb.id,
        subject_id: dsaSubject.id,
        topic: q.topic,
        difficulty_level: q.difficulty,
        question_text: q.text,
        marks: 2.00,
        negative_marks: 0.50,
        is_verified: true,
        status: 'approved',
        created_by: apexTeacher.id
      });

      for (const opt of q.options) {
        await QuestionOption.create({
          question_id: createdQ.id,
          option_key: opt.key,
          option_text: opt.text,
          is_correct: opt.is_correct
        });
      }
    }

    // 6. Create Active and Upcoming Exams
    const exam1 = await Exam.create({
      institution_id: apex.id,
      title: 'DSA Midterm Examination 2026',
      description: 'Standard 60-minute midterm test covering Units 1 through 3',
      instructions: '1. No electronic gadgets allowed. 2. Auto-submission takes place when the timer runs out.',
      subject_id: dsaSubject.id,
      class_id: cseClass.id,
      batch_id: batch2026A.id,
      exam_date: new Date().toISOString().split('T')[0],
      start_time: new Date(Date.now() - 1000 * 60 * 60), // Started 1 hour ago
      end_time: new Date(Date.now() + 1000 * 60 * 60 * 24), // Ends in 24 hours
      duration_minutes: 60,
      total_questions: 3,
      total_marks: 6.00,
      marks_per_question: 2.00,
      negative_marking: 0.50,
      passing_percentage: 40.00,
      selection_mode: 'random_fixed_pool',
      status: 'active',
      created_by: apexAdmin.id
    });

    // Link Questions to Exam 1
    const allQuestions = await Question.findAll({ where: { institution_id: apex.id } });
    for (let i = 0; i < allQuestions.length; i++) {
      await ExamQuestion.create({
        exam_id: exam1.id,
        question_id: allQuestions[i].id,
        question_order: i + 1
      });
    }

    // Assign All Students to Exam 1
    const allStudents = await Student.findAll({ where: { institution_id: apex.id } });
    for (const stu of allStudents) {
      await ExamAssignment.create({
        exam_id: exam1.id,
        student_id: stu.id,
        status: 'assigned'
      });
    }

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    await Exam.create({
      institution_id: apex.id,
      title: 'DBMS End-Semester Comprehensive Exam',
      description: 'Comprehensive test on SQL queries, normalization, ACID properties, and indexing',
      instructions: 'Each student receives an independently randomized set of questions.',
      subject_id: dbmsSubject.id,
      class_id: cseClass.id,
      batch_id: batch2026A.id,
      exam_date: nextWeek.toISOString().split('T')[0],
      start_time: new Date(nextWeek.setHours(14, 0, 0, 0)),
      end_time: new Date(nextWeek.setHours(16, 0, 0, 0)),
      duration_minutes: 90,
      total_questions: 60,
      total_marks: 120.00,
      marks_per_question: 2.00,
      negative_marking: 0.00,
      passing_percentage: 45.00,
      selection_mode: 'random_per_student',
      status: 'scheduled',
      created_by: apexTeacher.id
    });

    // 7. Seed realistic Audit Logs for Dashboard display
    const logEvents = [
      { user_id: apexAdmin.id, action: 'INSTITUTION_SETUP', entity_type: 'Institution', details: { msg: 'Configured academic departments & batches' } },
      { user_id: apexTeacher.id, action: 'CREATE_QUESTION_BANK', entity_type: 'QuestionBank', details: { msg: 'Created DSA Midterm Master Question Pool' } },
      { user_id: apexTeacher.id, action: 'ADD_QUESTIONS', entity_type: 'Question', details: { count: 3, msg: 'Verified and approved MCQ questions' } },
      { user_id: apexAdmin.id, action: 'SCHEDULE_EXAM', entity_type: 'Exam', details: { title: 'DSA Midterm Examination 2026' } },
      { user_id: superAdmin.id, action: 'SYSTEM_AUDIT', entity_type: 'System', details: { msg: 'Verified security certificates and connection pools' } }
    ];

    for (const log of logEvents) {
      await AuditLog.create({
        institution_id: apex.id,
        user_id: log.user_id,
        action: log.action,
        entity_type: log.entity_type,
        details: log.details,
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      });
    }

    logger.info('Database seeded successfully!');
    logger.info('========================================================');
    logger.info('DEFAULT DEMO CREDENTIALS:');
    logger.info('1. Super Admin:      superadmin@onlineexam.com / SuperAdmin@123');
    logger.info('2. Institution Admin: admin@apex.edu           / Admin@123');
    logger.info('3. Teacher:           teacher@apex.edu         / Teacher@123');
    logger.info('4. Student:           student1@apex.edu        / Student@123');
    logger.info('========================================================');

    if (shouldExit) {
      process.exit(0);
    }
  } catch (error) {
    logger.error('Database seeding failed:', error);
    if (shouldExit) {
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  runSeeder(true);
}

module.exports = { runSeeder };
