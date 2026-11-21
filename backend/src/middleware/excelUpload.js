const multer = require('multer');
const path = require('path');

// Memory storage keeps the buffer in RAM for instant parsing with xlsx
const storage = multer.memoryStorage();

const excelFileFilter = (req, file, cb) => {
  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();

  const isMimeAllowed = 
    file.mimetype.includes('spreadsheet') ||
    file.mimetype.includes('excel') ||
    file.mimetype.includes('csv') ||
    file.mimetype === 'application/octet-stream' ||
    file.mimetype === 'text/csv';

  if (allowedExtensions.includes(ext) || isMimeAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.'), false);
  }
};

const uploadExcel = multer({
  storage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB max file size
  }
});

module.exports = uploadExcel;
