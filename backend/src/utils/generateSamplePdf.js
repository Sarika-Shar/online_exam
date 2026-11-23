const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const generateTestPdf = async (outputPath) => {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  let y = height - 50;

  // Title
  page.drawText('Our International University - Examination Department', {
    x: 50,
    y,
    size: 16,
    font: timesBold,
    color: rgb(0.15, 0.39, 0.92)
  });
  y -= 25;

  page.drawText('Course: CS-301 Data Structures & Algorithms | MCQ Evaluation Set', {
    x: 50,
    y,
    size: 11,
    font: timesRoman,
    color: rgb(0.3, 0.3, 0.3)
  });
  y -= 20;

  // Separator
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  });
  y -= 25;

  const content = [
    {
      q: '1. Which algorithmic paradigm does Dijkstra\'s shortest path algorithm follow?',
      opts: [
        '*(A) Greedy Algorithm',
        '(B) Dynamic Programming',
        '(C) Divide and Conquer',
        '(D) Backtracking'
      ],
      ans: 'Answer: A',
      exp: 'Explanation: Dijkstra greedily selects the closest unvisited vertex with minimal tentative distance.'
    },
    {
      q: '2. What is the average time complexity of lookup in a properly dimensioned Hash Table?',
      opts: [
        '(A) O(n)',
        '(B) O(log n)',
        '*(C) O(1)',
        '(D) O(n log n)'
      ],
      ans: 'Answer: C',
      exp: 'Explanation: Direct addressing via hash index provides O(1) expected time lookup.'
    },
    {
      q: '3. What is the worst-case time complexity of QuickSort?',
      opts: [
        '(A) O(n log n)',
        '*(B) O(n^2)',
        '(C) O(n)',
        '(D) O(log n)'
      ],
      ans: 'Answer: B',
      exp: 'Explanation: Occurs when the selected pivot is repeatedly the smallest or largest element.'
    },
    {
      q: '4. In database transaction processing, what does the \'C\' in ACID guarantee?',
      opts: [
        '(A) Concurrency',
        '*(B) Consistency',
        '(C) Complexity',
        '(D) Compatibility'
      ],
      ans: 'Answer: B',
      exp: 'Explanation: Consistency ensures transitions from one valid database state to another.'
    }
  ];

  for (const item of content) {
    page.drawText(item.q, { x: 50, y, size: 11, font: timesBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;

    for (const opt of item.opts) {
      page.drawText(opt, { x: 65, y, size: 10, font: timesRoman, color: rgb(0.2, 0.2, 0.2) });
      y -= 15;
    }

    page.drawText(item.ans, { x: 65, y, size: 10, font: timesBold, color: rgb(0.06, 0.53, 0.27) });
    y -= 15;

    page.drawText(item.exp, { x: 65, y, size: 9, font: timesRoman, color: rgb(0.4, 0.4, 0.4) });
    y -= 25;
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  logger.info(`Sample test PDF generated successfully at: ${outputPath}`);
};

if (require.main === module) {
  const dest = path.resolve(__dirname, '../../uploads/sample_mcq_exam.pdf');
  generateTestPdf(dest).catch(console.error);
}

module.exports = { generateTestPdf };
