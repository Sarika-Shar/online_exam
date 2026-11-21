const fs = require('fs');
const pdfLib = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const logger = require('./logger');

/**
 * Normalizes question text for deduplication
 */
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, '') // preserves English and Hindi Devanagari chars
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Detects if text contains Devanagari (Hindi) characters
 */
const detectLanguage = (text) => {
  const hindiRegex = /[\u0900-\u097F]/;
  return hindiRegex.test(text) ? 'hi' : 'en';
};

/**
 * Extracts raw text from a PDF file using pdf-parse (supports class or function)
 * @param {string} filePath 
 * @returns {Promise<{ text: string, numpages: number, isScanned: boolean }>}
 */
const extractRawTextFromPdf = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  let rawText = '';
  let pageCount = 1;

  if (pdfLib.PDFParse) {
    const parser = new pdfLib.PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    rawText = result.text || '';
    pageCount = result.total || (result.pages ? result.pages.length : 1);
    await parser.destroy();
  } else if (typeof pdfLib === 'function') {
    const result = await pdfLib(dataBuffer);
    rawText = result.text || '';
    pageCount = result.numpages || 1;
  } else {
    throw new Error('Unsupported pdf-parse module format.');
  }

  const trimmedText = rawText.trim();
  const isScanned = trimmedText.length < 50;

  return {
    text: trimmedText,
    numpages: pageCount,
    isScanned
  };
};

/**
 * Performs OCR using Tesseract.js when the PDF is scanned or image-based
 * @param {string} filePath
 * @param {string} language 'eng' or 'hin' or 'eng+hin'
 * @returns {Promise<string>} extracted OCR text
 */
const performOcr = async (filePath, language = 'eng') => {
  logger.info(`Starting Tesseract OCR for file: ${filePath} with language: ${language}`);
  let worker;
  try {
    worker = await createWorker(language);
    const ret = await worker.recognize(filePath);
    await worker.terminate();
    logger.info(`OCR completed successfully. Extracted ${ret.data.text.length} characters.`);
    return ret.data.text;
  } catch (err) {
    logger.error('OCR processing error:', err.message);
    if (worker) {
      await worker.terminate();
    }
    throw new Error(`OCR processing failed: ${err.message}`);
  }
};

/**
 * State machine parser to extract MCQs, options A-D, marked answers, and explanations
 * @param {string} fullText 
 * @returns {Array<Object>} parsed questions
 */
const parseQuestionsFromText = (fullText) => {
  if (!fullText || typeof fullText !== 'string') {
    return [];
  }

  const cleanText = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n');
  const questions = [];

  let currentQuestion = null;
  let currentOptionKey = null;

  const questionStartRegex = /^(?:(?:Q|Question|प्रश्न)\s*[\.\:\-]?\s*(\d+)|\b(\d+)[\.\)\:\-])\s*(.*)$/i;
  const optionStartRegex = /^(?:\*|\(correct\)|\[x\])?\s*(?:\(([A-Dक-घ])\)|([A-Dक-घ])[\.\)\]\:])\s*(.*)$/i;
  const answerLineRegex = /^(?:Answer|Ans|Correct\s*Answer|उत्तर)\s*[\:\-\=]?\s*(?:\(?([A-Dक-घ])\)?)?(.*)$/i;
  const explanationRegex = /^(?:Explanation|Exp|व्याख्या)\s*[\:\-]?\s*(.*)$/i;

  const normalizeOptionKey = (k) => {
    if (!k) return 'A';
    const upper = k.toUpperCase();
    if (upper === 'क') return 'A';
    if (upper === 'ख') return 'B';
    if (upper === 'ग') return 'C';
    if (upper === 'घ') return 'D';
    return upper;
  };

  const finalizeQuestion = (q) => {
    if (!q || !q.question_text || q.question_text.trim().length === 0) return null;

    const finalOptions = ['A', 'B', 'C', 'D'].map(key => {
      const existing = q.options.find(o => o.option_key === key);
      return {
        option_key: key,
        option_text: existing ? existing.option_text.trim() : `Option ${key}`,
        is_correct: q.correct_option === key
      };
    });

    const lang = detectLanguage(q.question_text);

    return {
      temp_id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question_text: q.question_text.trim(),
      options: finalOptions,
      correct_answer: q.correct_option || null,
      explanation: q.explanation ? q.explanation.trim() : '',
      language: lang,
      difficulty_level: 'medium',
      marks: 1.0,
      negative_marks: 0.0,
      topic: q.topic || 'General',
      is_valid: finalOptions.every(o => o.option_text.length > 0) && !!q.correct_option,
      is_verified: false, // MANDATORY: Never published without admin verification
      status: 'pending_approval'
    };
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const qMatch = rawLine.match(questionStartRegex);
    if (qMatch) {
      if (currentQuestion) {
        const finished = finalizeQuestion(currentQuestion);
        if (finished) questions.push(finished);
      }

      currentOptionKey = null;
      currentQuestion = {
        question_number: qMatch[1] || qMatch[2] || (questions.length + 1),
        question_text: (qMatch[3] || '').trim(),
        options: [],
        correct_option: null,
        explanation: ''
      };
      continue;
    }

    if (!currentQuestion) continue;

    const ansMatch = rawLine.match(answerLineRegex);
    if (ansMatch) {
      const foundKey = ansMatch[1] ? normalizeOptionKey(ansMatch[1]) : null;
      if (foundKey) {
        currentQuestion.correct_option = foundKey;
      }
      currentOptionKey = null;
      continue;
    }

    const expMatch = rawLine.match(explanationRegex);
    if (expMatch) {
      currentQuestion.explanation = (expMatch[1] || '').trim();
      currentOptionKey = null;
      continue;
    }

    const optMatch = rawLine.match(optionStartRegex);
    if (optMatch) {
      const rawKey = optMatch[1] || optMatch[2];
      const optKey = normalizeOptionKey(rawKey);
      const optText = (optMatch[3] || '').trim();

      const isMarked = rawLine.startsWith('*') || 
                       rawLine.includes('(correct)') || 
                       rawLine.includes('[x]') || 
                       rawLine.endsWith('*');

      if (isMarked) {
        currentQuestion.correct_option = optKey;
      }

      currentOptionKey = optKey;
      currentQuestion.options.push({
        option_key: optKey,
        option_text: optText.replace(/\*$/, '').trim()
      });
      continue;
    }

    if (currentOptionKey) {
      const targetOpt = currentQuestion.options.find(o => o.option_key === currentOptionKey);
      if (targetOpt) {
        targetOpt.option_text += ' ' + rawLine;
      }
      continue;
    }

    if (currentQuestion && currentQuestion.options.length === 0) {
      currentQuestion.question_text += ' ' + rawLine;
    }
  }

  if (currentQuestion) {
    const finished = finalizeQuestion(currentQuestion);
    if (finished) questions.push(finished);
  }

  return questions;
};

module.exports = {
  extractRawTextFromPdf,
  performOcr,
  parseQuestionsFromText,
  normalizeText,
  detectLanguage
};
