const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const portalBaseUrl = process.env.CLIENT_URL || 'https://online-exam-two-sage.vercel.app';

/**
 * Initialize reusable Nodemailer transporter
 */
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    logger.info(`EmailService: Configured active SMTP transport via ${host}:${port}`);
  } else {
    logger.info('EmailService: No SMTP credentials configured. Running in simulated preview mode (logged to console).');
  }

  return transporter;
};

/**
 * Generate standard HTML email template for student login credentials
 */
const generateStudentWelcomeHtml = ({ name, email, username, password, portalUrl = portalBaseUrl }) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0d6efd, #0b5ed7); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; color: #333333; line-height: 1.6; }
    .badge { display: inline-block; background: #e7f1ff; color: #0d6efd; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 13px; margin-bottom: 15px; }
    .cred-box { background: #f8f9fa; border: 1px solid #e9ecef; border-left: 4px solid #0d6efd; border-radius: 6px; padding: 20px; margin: 20px 0; }
    .cred-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #dee2e6; }
    .cred-row:last-child { border-bottom: none; }
    .label { color: #6c757d; font-weight: 500; }
    .value { font-weight: 700; color: #212529; font-family: monospace; font-size: 15px; }
    .btn-container { text-align: center; margin: 30px 0; }
    .btn { display: inline-block; background: #0d6efd; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 10px rgba(13,110,253,0.3); }
    .tips { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 6px; font-size: 13px; color: #664d03; margin-top: 25px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>SARBIT INFOTECH</h1>
      <p>Institutional Online Examination Management System</p>
    </div>
    <div class="content">
      <span class="badge">Student Account Created</span>
      <p>Dear <strong>${name}</strong>,</p>
      <p>Welcome! Your official online examination portal account has been successfully generated. Below are your login credentials to access the examination hall and tests.</p>
      
      <div class="cred-box">
        <div class="cred-row">
          <span class="label">Portal Web Link:</span>
          <span class="value"><a href="${portalUrl}" style="color: #0d6efd;">${portalUrl}</a></span>
        </div>
        <div class="cred-row">
          <span class="label">Registered Email:</span>
          <span class="value">${email}</span>
        </div>
        <div class="cred-row">
          <span class="label">Username:</span>
          <span class="value">${username}</span>
        </div>
        <div class="cred-row">
          <span class="label">Temporary Password:</span>
          <span class="value" style="color: #d63384;">${password}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${portalUrl}/login" class="btn">Sign In to Examination Portal &rarr;</a>
      </div>

      <div class="tips">
        <strong>⚠️ Important Instructions for Candidates:</strong>
        <ul style="margin: 5px 0 0 0; padding-left: 20px;">
          <li>Please test your login prior to the scheduled examination time.</li>
          <li>Ensure an uninterrupted internet connection and Chrome browser.</li>
          <li>Full-screen surveillance and AI proctoring will be active during tests.</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} SARBIT INFOTECH. All rights reserved.<br>This is an automated system notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Send credentials email to a single student
 */
const sendStudentCredentialsEmail = async ({ name, email, username, password, portalUrl }) => {
  try {
    const fromAddress = process.env.SMTP_FROM || '"SARBIT INFOTECH Examination Platform" <no-reply@sarbitinfotech.com>';
    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: '🎓 Your Online Examination Portal Login Credentials - SARBIT INFOTECH',
      html: generateStudentWelcomeHtml({ name, email, username, password, portalUrl })
    };

    const client = getTransporter();
    if (client) {
      const info = await client.sendMail(mailOptions);
      logger.info(`Email successfully dispatched to ${email} [MessageID: ${info.messageId}]`);
      return { success: true, messageId: info.messageId };
    } else {
      logger.info(`[SIMULATED EMAIL DISPATCH] To: ${email} | Name: ${name} | Username: ${username} | Password: ${password}`);
      return { success: true, simulated: true };
    }
  } catch (error) {
    logger.error(`Failed to send credentials email to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send credentials emails to multiple students in controlled concurrent batches
 */
const sendBulkCredentialsEmails = async (studentsList = [], portalUrl) => {
  if (!Array.isArray(studentsList) || studentsList.length === 0) return;

  logger.info(`Starting asynchronous bulk email dispatch for ${studentsList.length} students...`);

  // Process in batches of 5 to avoid throttling
  const batchSize = 5;
  for (let i = 0; i < studentsList.length; i += batchSize) {
    const chunk = studentsList.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(student =>
        sendStudentCredentialsEmail({
          name: student.name,
          email: student.email,
          username: student.username,
          password: student.password || 'Student@123',
          portalUrl
        })
      )
    );
  }

  logger.info(`Bulk email dispatch completed for ${studentsList.length} students.`);
};

module.exports = {
  sendStudentCredentialsEmail,
  sendBulkCredentialsEmails
};
