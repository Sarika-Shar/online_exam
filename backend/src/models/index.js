const { sequelize } = require('../config/database');

const Institution = require('./Institution');
const User = require('./User');
const AuditLog = require('./AuditLog');
const Class = require('./Class');
const Subject = require('./Subject');
const Batch = require('./Batch');
const Student = require('./Student');
const QuestionBank = require('./QuestionBank');
const Question = require('./Question');
const QuestionOption = require('./QuestionOption');
const PdfUpload = require('./PdfUpload');
const Exam = require('./Exam');
const ExamQuestion = require('./ExamQuestion');
const ExamAssignment = require('./ExamAssignment');
const ExamAttempt = require('./ExamAttempt');
const StudentAnswer = require('./StudentAnswer');
const ExamResult = require('./ExamResult');
const Winner = require('./Winner');
const Prize = require('./Prize');
const Certificate = require('./Certificate');
const ProctorSnapshot = require('./ProctorSnapshot');
const QuestionChallenge = require('./QuestionChallenge');

// --- Associations ---

// Institution Associations
Institution.hasMany(User, { foreignKey: 'institution_id', as: 'users' });
User.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });

Institution.hasMany(Class, { foreignKey: 'institution_id', as: 'classes' });
Class.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });

Institution.hasMany(Subject, { foreignKey: 'institution_id', as: 'subjects' });
Subject.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });

Institution.hasMany(Batch, { foreignKey: 'institution_id', as: 'batches' });
Batch.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });

Institution.hasMany(Student, { foreignKey: 'institution_id', as: 'students' });
Student.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });

Institution.hasMany(Exam, { foreignKey: 'institution_id', as: 'exams' });
Exam.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });

Institution.hasMany(AuditLog, { foreignKey: 'institution_id', as: 'audit_logs' });
AuditLog.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });

// Academic Hierarchy
Class.hasMany(Batch, { foreignKey: 'class_id', as: 'batches' });
Batch.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Class.hasMany(Subject, { foreignKey: 'class_id', as: 'subjects' });
Subject.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

// Student Connections
User.hasOne(Student, { foreignKey: 'user_id', as: 'student_profile' });
Student.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Class.hasMany(Student, { foreignKey: 'class_id', as: 'students' });
Student.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Batch.hasMany(Student, { foreignKey: 'batch_id', as: 'students' });
Student.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });

// Question Bank & Questions
Subject.hasMany(QuestionBank, { foreignKey: 'subject_id', as: 'question_banks' });
QuestionBank.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });

QuestionBank.hasMany(Question, { foreignKey: 'question_bank_id', as: 'questions' });
Question.belongsTo(QuestionBank, { foreignKey: 'question_bank_id', as: 'question_bank' });

Subject.hasMany(Question, { foreignKey: 'subject_id', as: 'questions' });
Question.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });

Question.hasMany(QuestionOption, { foreignKey: 'question_id', as: 'options', onDelete: 'CASCADE' });
QuestionOption.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

PdfUpload.hasMany(Question, { foreignKey: 'source_pdf_id', as: 'extracted_questions' });
Question.belongsTo(PdfUpload, { foreignKey: 'source_pdf_id', as: 'source_pdf' });

// Exam Associations
Exam.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });
Exam.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' });
Exam.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });

Exam.belongsToMany(Question, { through: ExamQuestion, foreignKey: 'exam_id', as: 'questions' });
Question.belongsToMany(Exam, { through: ExamQuestion, foreignKey: 'question_id', as: 'exams' });
Exam.hasMany(ExamQuestion, { foreignKey: 'exam_id', as: 'exam_question_links' });
ExamQuestion.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });
ExamQuestion.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

// Exam Assignments & Attempts
Exam.hasMany(ExamAssignment, { foreignKey: 'exam_id', as: 'assignments' });
ExamAssignment.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });
Student.hasMany(ExamAssignment, { foreignKey: 'student_id', as: 'exam_assignments' });
ExamAssignment.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

Exam.hasMany(ExamAttempt, { foreignKey: 'exam_id', as: 'attempts' });
ExamAttempt.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });
Student.hasMany(ExamAttempt, { foreignKey: 'student_id', as: 'attempts' });
ExamAttempt.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

// Attempt Answers
ExamAttempt.hasMany(StudentAnswer, { foreignKey: 'exam_attempt_id', as: 'answers', onDelete: 'CASCADE' });
StudentAnswer.belongsTo(ExamAttempt, { foreignKey: 'exam_attempt_id', as: 'attempt' });
StudentAnswer.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

// Exam Results
Exam.hasMany(ExamResult, { foreignKey: 'exam_id', as: 'results' });
ExamResult.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });
Student.hasMany(ExamResult, { foreignKey: 'student_id', as: 'results' });
ExamResult.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });
ExamAttempt.hasOne(ExamResult, { foreignKey: 'exam_attempt_id', as: 'result' });
ExamResult.belongsTo(ExamAttempt, { foreignKey: 'exam_attempt_id', as: 'attempt' });

// Winners & Prizes
Exam.hasMany(Winner, { foreignKey: 'exam_id', as: 'winners' });
Winner.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });
Student.hasMany(Winner, { foreignKey: 'student_id', as: 'winner_positions' });
Winner.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

Exam.hasMany(Prize, { foreignKey: 'exam_id', as: 'prizes' });
Prize.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });

// Certificates
Exam.hasMany(Certificate, { foreignKey: 'exam_id', as: 'certificates' });
Certificate.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });
Student.hasMany(Certificate, { foreignKey: 'student_id', as: 'certificates' });
Certificate.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

// Audit Log User Link
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'audit_logs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Proctor Surveillance Snapshots
ExamAttempt.hasMany(ProctorSnapshot, { foreignKey: 'exam_attempt_id', as: 'snapshots' });
ProctorSnapshot.belongsTo(ExamAttempt, { foreignKey: 'exam_attempt_id', as: 'attempt' });
Student.hasMany(ProctorSnapshot, { foreignKey: 'student_id', as: 'snapshots' });
ProctorSnapshot.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });
Institution.hasMany(ProctorSnapshot, { foreignKey: 'institution_id', as: 'proctor_snapshots' });
ProctorSnapshot.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });

// Question Key Challenges & Grievance Redressal Associations
Exam.hasMany(QuestionChallenge, { foreignKey: 'exam_id', as: 'challenges' });
QuestionChallenge.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });
Question.hasMany(QuestionChallenge, { foreignKey: 'question_id', as: 'challenges' });
QuestionChallenge.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });
Student.hasMany(QuestionChallenge, { foreignKey: 'student_id', as: 'challenges' });
QuestionChallenge.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });
ExamAttempt.hasMany(QuestionChallenge, { foreignKey: 'exam_attempt_id', as: 'challenges' });
QuestionChallenge.belongsTo(ExamAttempt, { foreignKey: 'exam_attempt_id', as: 'attempt' });
Institution.hasMany(QuestionChallenge, { foreignKey: 'institution_id', as: 'question_challenges' });
QuestionChallenge.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });
User.hasMany(QuestionChallenge, { foreignKey: 'reviewed_by', as: 'reviewed_challenges' });
QuestionChallenge.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

module.exports = {
  sequelize,
  Institution,
  User,
  AuditLog,
  Class,
  Subject,
  Batch,
  Student,
  QuestionBank,
  Question,
  QuestionOption,
  PdfUpload,
  Exam,
  ExamQuestion,
  ExamAssignment,
  ExamAttempt,
  StudentAnswer,
  ExamResult,
  Winner,
  Prize,
  Certificate,
  ProctorSnapshot,
  QuestionChallenge
};
