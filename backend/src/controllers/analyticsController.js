const { Op } = require('sequelize');
const {
  Exam,
  ExamResult,
  ExamAttempt,
  ExamQuestion,
  Question,
  QuestionOption,
  StudentAnswer,
  Subject,
  Class
} = require('../models');

/**
 * Psychometric Item Analysis (Difficulty Index & Discrimination Index)
 */
const getExamItemAnalysis = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;

    const exam = await Exam.findOne({
      where: { id: examId, institution_id: institutionId },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
        { model: Class, as: 'class', attributes: ['id', 'name'] }
      ]
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Examination not found.' });
    }

    // 1. Fetch all evaluated results ordered by score descending for Upper/Lower 27% split
    const results = await ExamResult.findAll({
      where: { exam_id: examId },
      order: [['total_marks_obtained', 'DESC']]
    });

    const totalCandidates = results.length;
    if (totalCandidates === 0) {
      return res.status(200).json({
        success: true,
        exam: { id: exam.id, title: exam.title },
        message: 'No candidate results available for psychometric item analysis yet.',
        totalCandidates: 0,
        itemAnalysis: []
      });
    }

    // Calculate upper 27% and lower 27% cohort sizes
    const cohortSize = Math.max(1, Math.round(totalCandidates * 0.27));
    const upperCohortAttemptIds = results.slice(0, cohortSize).map(r => r.exam_attempt_id);
    const lowerCohortAttemptIds = results.slice(Math.max(0, totalCandidates - cohortSize)).map(r => r.exam_attempt_id);

    // 2. Fetch exam questions with options
    const examQuestions = await ExamQuestion.findAll({
      where: { exam_id: examId },
      include: [
        {
          model: Question,
          as: 'question',
          include: [{ model: QuestionOption, as: 'options' }]
        }
      ],
      order: [['question_order', 'ASC']]
    });

    // 3. Fetch all student answers for these attempts
    const allAttemptIds = results.map(r => r.exam_attempt_id);
    const allAnswers = await StudentAnswer.findAll({
      where: { exam_attempt_id: { [Op.in]: allAttemptIds } }
    });

    // Map answers by question_id -> array of answers
    const answersByQuestion = new Map();
    for (const ans of allAnswers) {
      if (!answersByQuestion.has(ans.question_id)) {
        answersByQuestion.set(ans.question_id, []);
      }
      answersByQuestion.get(ans.question_id).push(ans);
    }

    // 4. Compute Item Metrics per Question
    const itemAnalysis = [];

    for (const eq of examQuestions) {
      const q = eq.question;
      if (!q) continue;

      const qAnswers = answersByQuestion.get(q.id) || [];
      const attemptedCount = qAnswers.filter(a => a.selected_option_key !== null).length;
      const correctCount = qAnswers.filter(a => a.is_correct).length;

      // Item Difficulty Index (P-value: proportion answering correctly)
      const pValue = totalCandidates > 0 ? parseFloat((correctCount / totalCandidates).toFixed(3)) : 0;
      let difficultyRating = 'Moderate';
      if (pValue >= 0.75) difficultyRating = 'Easy';
      else if (pValue < 0.35) difficultyRating = 'Hard';

      // Item Discrimination Index (D-index: Upper 27% vs Lower 27%)
      const upperCorrect = qAnswers.filter(a => upperCohortAttemptIds.includes(a.exam_attempt_id) && a.is_correct).length;
      const lowerCorrect = qAnswers.filter(a => lowerCohortAttemptIds.includes(a.exam_attempt_id) && a.is_correct).length;
      const dIndex = parseFloat(((upperCorrect - lowerCorrect) / cohortSize).toFixed(3));

      let discriminationRating = 'Good';
      if (dIndex >= 0.40) discriminationRating = 'Excellent';
      else if (dIndex >= 0.20 && dIndex < 0.30) discriminationRating = 'Marginal';
      else if (dIndex < 0.20) discriminationRating = 'Poor / Needs Review';

      // Distractor Analysis (Option frequency)
      const optionCounts = {};
      (q.options || []).forEach(opt => {
        optionCounts[opt.option_key] = 0;
      });

      for (const a of qAnswers) {
        if (a.selected_option_key && optionCounts[a.selected_option_key] !== undefined) {
          optionCounts[a.selected_option_key]++;
        }
      }

      const distractors = (q.options || []).map(opt => ({
        key: opt.option_key,
        text: opt.option_text,
        isCorrect: opt.is_correct,
        selectedCount: optionCounts[opt.option_key] || 0,
        selectionPercentage: totalCandidates > 0
          ? parseFloat((((optionCounts[opt.option_key] || 0) / totalCandidates) * 100).toFixed(1))
          : 0
      }));

      itemAnalysis.push({
        questionId: q.id,
        order: eq.question_order,
        questionText: q.question_text,
        marks: parseFloat(eq.marks),
        negativeMarks: parseFloat(eq.negative_marks),
        totalAttempts: attemptedCount,
        correctCount,
        difficultyIndex: pValue,
        difficultyRating,
        discriminationIndex: dIndex,
        discriminationRating,
        distractors
      });
    }

    return res.status(200).json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject?.name,
        totalQuestions: exam.total_questions,
        totalMarks: exam.total_marks
      },
      totalCandidates,
      cohortSize27Percent: cohortSize,
      itemAnalysis
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cohort Score Distribution & Descriptive Statistics
 */
const getExamCohortAnalytics = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;

    const results = await ExamResult.findAll({
      where: { exam_id: examId, institution_id: institutionId }
    });

    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No candidate scores recorded yet.',
        totalCandidates: 0,
        statistics: null,
        distributionBins: []
      });
    }

    const scores = results.map(r => parseFloat(r.total_marks_obtained));
    const percentages = results.map(r => parseFloat(r.percentage));
    const passedCount = results.filter(r => r.is_passed).length;
    const totalCandidates = results.length;

    // Mean, Min, Max
    const mean = parseFloat((scores.reduce((a, b) => a + b, 0) / totalCandidates).toFixed(2));
    const sortedScores = [...scores].sort((a, b) => a - b);
    const min = sortedScores[0];
    const max = sortedScores[sortedScores.length - 1];
    const median = totalCandidates % 2 === 0
      ? parseFloat(((sortedScores[totalCandidates / 2 - 1] + sortedScores[totalCandidates / 2]) / 2).toFixed(2))
      : sortedScores[Math.floor(totalCandidates / 2)];

    // Standard Deviation & Variance
    const variance = parseFloat(
      (scores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / totalCandidates).toFixed(2)
    );
    const stdDev = parseFloat(Math.sqrt(variance).toFixed(2));

    // Score Range Bins for Gaussian distribution rendering
    const bins = [
      { range: '0 - 20%', count: 0, label: 'Very Low' },
      { range: '21 - 40%', count: 0, label: 'Low' },
      { range: '41 - 60%', count: 0, label: 'Average' },
      { range: '61 - 80%', count: 0, label: 'Good' },
      { range: '81 - 100%', count: 0, label: 'Excellent' }
    ];

    percentages.forEach(p => {
      if (p <= 20) bins[0].count++;
      else if (p <= 40) bins[1].count++;
      else if (p <= 60) bins[2].count++;
      else if (p <= 80) bins[3].count++;
      else bins[4].count++;
    });

    return res.status(200).json({
      success: true,
      totalCandidates,
      statistics: {
        mean,
        median,
        min,
        max,
        standardDeviation: stdDev,
        variance,
        passPercentage: parseFloat(((passedCount / totalCandidates) * 100).toFixed(2)),
        passCount: passedCount,
        failCount: totalCandidates - passedCount
      },
      distributionBins: bins
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExamItemAnalysis,
  getExamCohortAnalytics
};
