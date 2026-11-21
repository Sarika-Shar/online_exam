const { Op } = require('sequelize');
const {
  Student,
  Exam,
  Question,
  ExamResult,
  AuditLog,
  User,
  Subject,
  Class,
  Institution
} = require('../models');

/**
 * Get aggregated dashboard statistics
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const filter = institutionId ? { institution_id: institutionId } : {};

    // Parallel counts for optimal performance
    const [
      totalStudents,
      totalExams,
      activeExams,
      completedExams,
      totalQuestions,
      totalResults,
      totalInstitutions,
      totalTeachers
    ] = await Promise.all([
      Student.count({ where: filter }),
      Exam.count({ where: filter }),
      Exam.count({
        where: {
          ...filter,
          status: 'active'
        }
      }),
      Exam.count({
        where: {
          ...filter,
          status: 'completed'
        }
      }),
      Question.count({ where: filter }),
      ExamResult.count({ where: filter }),
      req.user.role === 'super_admin' ? Institution.count() : Promise.resolve(1),
      User.count({ where: { ...filter, role: 'teacher' } })
    ]);

    // Fetch Recent Activities (Audit Log)
    const recentActivities = await AuditLog.findAll({
      where: filter,
      limit: 8,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'role', 'email']
        }
      ]
    });

    // Fetch Upcoming Exams
    const now = new Date();
    const upcomingExams = await Exam.findAll({
      where: {
        ...filter,
        status: { [Op.in]: ['scheduled', 'active'] },
        end_time: { [Op.gte]: now }
      },
      order: [['start_time', 'ASC']],
      limit: 6,
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
        { model: Class, as: 'class', attributes: ['id', 'name'] }
      ]
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalStudents,
          totalTeachers,
          totalExams,
          activeExams,
          completedExams,
          totalQuestions,
          totalResults,
          totalInstitutions
        },
        recentActivities,
        upcomingExams
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats
};
