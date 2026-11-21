require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const { sequelize, testConnection } = require('./src/config/database');
const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimiter');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const institutionRoutes = require('./src/routes/institutionRoutes');
const userRoutes = require('./src/routes/userRoutes');
const pdfUploadRoutes = require('./src/routes/pdfUploadRoutes');
const academicRoutes = require('./src/routes/academicRoutes');
const questionRoutes = require('./src/routes/questionRoutes');
const examRoutes = require('./src/routes/examRoutes');
const studentExamRoutes = require('./src/routes/studentExamRoutes');
const resultRoutes = require('./src/routes/resultRoutes');
const winnerRoutes = require('./src/routes/winnerRoutes');
const certificateRoutes = require('./src/routes/certificateRoutes');
const auditLogRoutes = require('./src/routes/auditLogRoutes');
const liveMonitorRoutes = require('./src/routes/liveMonitorRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const proctorRoutes = require('./src/routes/proctorRoutes');
const challengeRoutes = require('./src/routes/challengeRoutes');

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for live exam monitoring and real-time alerts
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Attach Socket.IO to app for use in controllers
app.set('io', io);

// Security & Utility Middlewares
app.use(helmet({
  contentSecurityPolicy: false // Allows inline scripts for frontend dev when needed
}));
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general API rate limiter
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dialect: process.env.DB_DIALECT || 'mysql',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Production system telemetry & metrics endpoint
app.get('/api/metrics', (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssMb: (memoryUsage.rss / 1024 / 1024).toFixed(2),
      heapTotalMb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
      heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      externalMb: (memoryUsage.external / 1024 / 1024).toFixed(2)
    },
    database: {
      dialect: process.env.DB_DIALECT || 'mysql',
      poolMax: process.env.DB_POOL_MAX || 20
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pdf-upload', pdfUploadRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/student', studentExamRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/winners', winnerRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/live-monitor', liveMonitorRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/proctor', proctorRoutes);
app.use('/api/challenges', challengeRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.originalUrl}`
  });
});

// Centralized Error Handler
app.use(errorHandler);

// Socket.IO event handling
io.on('connection', (socket) => {
  logger.info(`Live Monitoring: Client connected [Socket ID: ${socket.id}]`);

  socket.on('join_exam_room', ({ examId, studentId }) => {
    socket.join(`exam_${examId}`);
    logger.info(`Student ${studentId} joined live exam room: exam_${examId}`);
  });

  socket.on('join_monitor_room', ({ examId }) => {
    socket.join(`exam_${examId}`);
    logger.info(`Proctor joined live monitor room for exam: exam_${examId}`);
  });

  socket.on('tab_switch_anomaly', ({ examId, studentId, studentName, timestamp }) => {
    logger.warn(`Anomaly detected: Candidate ${studentName} (${studentId}) switched tabs at ${timestamp}`);
    io.to(`exam_${examId}`).emit('telemetry_anomaly', {
      type: 'TAB_SWITCH',
      studentId,
      studentName,
      timestamp: timestamp || new Date().toISOString(),
      message: `Candidate ${studentName} switched away from the examination window.`
    });
  });

  socket.on('watermark_tamper_anomaly', ({ examId, studentId, studentName, timestamp, details }) => {
    logger.warn(`Security anomaly: Candidate ${studentName} (${studentId}) attempted watermark tampering!`);
    io.to(`exam_${examId}`).emit('telemetry_anomaly', {
      type: 'WATERMARK_TAMPER',
      studentId,
      studentName,
      timestamp: timestamp || new Date().toISOString(),
      message: `Candidate ${studentName} attempted to inspect/modify anti-leak watermark DOM elements.`,
      details
    });
  });

  socket.on('disconnect', () => {
    logger.info(`Live Monitoring: Client disconnected [Socket ID: ${socket.id}]`);
  });
});

// Database Sync and Server Startup
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await testConnection();

    // Synchronize models with database (alter: false maintains backward compatibility)
    await sequelize.sync({ alter: false });

    // Safe migration: ensure Phase 12 proctor surveillance columns exist
    try {
      const dialect = sequelize.getDialect();
      if (dialect === 'sqlite') {
        const [columns] = await sequelize.query("PRAGMA table_info(exam_attempts);");
        const columnNames = (columns || []).map(c => c.name);
        if (!columnNames.includes('integrity_score')) {
          await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN integrity_score INTEGER DEFAULT 100;");
        }
        if (!columnNames.includes('proctor_verdict')) {
          await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN proctor_verdict TEXT DEFAULT 'pending';");
        }
        if (!columnNames.includes('proctor_notes')) {
          await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN proctor_notes TEXT;");
        }
        if (!columnNames.includes('proctor_reviewed_by')) {
          await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN proctor_reviewed_by INTEGER;");
        }
        if (!columnNames.includes('proctor_reviewed_at')) {
          await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN proctor_reviewed_at DATETIME;");
        }
        if (!columnNames.includes('is_paused')) {
          await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN is_paused TINYINT(1) DEFAULT 0;");
        }
        if (!columnNames.includes('paused_at')) {
          await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN paused_at DATETIME;");
        }
        if (!columnNames.includes('total_paused_seconds')) {
          await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN total_paused_seconds INTEGER DEFAULT 0;");
        }
        if (!columnNames.includes('proctor_interventions_count')) {
          await sequelize.query("ALTER TABLE exam_attempts ADD COLUMN proctor_interventions_count INTEGER DEFAULT 0;");
        }
      }
    } catch (migErr) {
      logger.warn(`Proctor columns auto-migration warning: ${migErr.message}`);
    }

    logger.info('Database models synchronized successfully.');

    // Auto-seed if running on a fresh SQLite/database with no users
    try {
      const { User } = require('./src/models');
      const userCount = await User.count();
      if (userCount === 0) {
        logger.info('Empty database detected. Auto-seeding initial users and institutions...');
        const { runSeeder } = require('./src/seeders/seed');
        await runSeeder(false, false);
        logger.info('Initial seed completed successfully.');
      }
    } catch (autoSeedErr) {
      logger.warn(`Auto-seeding check warning: ${autoSeedErr.message}`);
    }

    // Initialize Phase 6 background exam expiry job
    const { startExpiryJob } = require('./src/jobs/examExpiryJob');
    startExpiryJob(io, 30000);

    server.listen(PORT, () => {
      logger.info(`Enterprise Online Examination Backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
      logger.info(`Health check available at http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful Shutdown Handlers
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} signal received. Starting graceful shutdown sequence...`);
  server.close(async () => {
    logger.info('HTTP and WebSocket server closed to new requests.');
    try {
      await sequelize.close();
      logger.info('Database connection pool drained and terminated cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error('Error while closing database connections:', err);
      process.exit(1);
    }
  });

  // Force shutdown after 10s if connections refuse to drain
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded (10s). Forcing process termination.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server };
