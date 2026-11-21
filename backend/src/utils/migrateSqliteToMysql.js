const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('./logger');

// SQLite connection
const sqliteDb = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(__dirname, '../../database.sqlite'),
  logging: false
});

// MySQL connection (XAMPP default: root, no password, 127.0.0.1:3306)
const mysqlDb = new Sequelize('online_exam_db', 'root', '', {
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

// Import model definitions with their schemas
const defineModels = (sequelize) => {
  const Institution = require('../models/Institution');
  // Re-define for target or use raw table transfer
};

async function migrate() {
  console.log('====================================================');
  console.log('🔄 STARTING SQLITE TO MYSQL DATA MIGRATION');
  console.log('====================================================');

  try {
    await sqliteDb.authenticate();
    console.log('✓ Connected to SQLite database.');

    await mysqlDb.authenticate();
    console.log('✓ Connected to XAMPP MySQL database (online_exam_db).');

    // Ordered list of tables to respect foreign key constraints
    const tables = [
      'institutions',
      'users',
      'audit_logs',
      'classes',
      'subjects',
      'batches',
      'students',
      'question_banks',
      'pdf_uploads',
      'questions',
      'question_options',
      'exams',
      'exam_questions',
      'exam_assignments',
      'exam_attempts',
      'student_answers',
      'exam_results',
      'winners',
      'prizes',
      'certificates',
      'proctor_snapshots',
      'question_challenges'
    ];

    // Disable foreign key checks on MySQL during transfer
    await mysqlDb.query('SET FOREIGN_KEY_CHECKS = 0;');

    // First, let Sequelize models sync schema on MySQL
    // Temporarily switch DB_DIALECT for models load
    process.env.DB_DIALECT = 'mysql';
    process.env.DB_NAME = 'online_exam_db';
    process.env.DB_USER = 'root';
    process.env.DB_PASSWORD = '';
    process.env.DB_HOST = '127.0.0.1';

    const models = require('../models');
    await models.sequelize.sync({ alter: true });
    console.log('✓ MySQL tables created & synchronized with Sequelize models.');

    let totalMigratedRows = 0;

    for (const table of tables) {
      try {
        const [sqliteRows] = await sqliteDb.query(`SELECT * FROM \`${table}\``);
        if (sqliteRows.length === 0) {
          console.log(`- Table [${table}]: 0 rows (skipped)`);
          continue;
        }

        // Clear existing rows in target table
        await mysqlDb.query(`DELETE FROM \`${table}\``);

        // Insert into MySQL
        for (const row of sqliteRows) {
          const keys = Object.keys(row).map(k => `\`${k}\``).join(', ');
          const values = Object.values(row);
          const placeholders = values.map(() => '?').join(', ');

          await mysqlDb.query(
            `INSERT INTO \`${table}\` (${keys}) VALUES (${placeholders})`,
            { replacements: values }
          );
        }

        console.log(`✓ Table [${table}]: ${sqliteRows.length} rows migrated successfully.`);
        totalMigratedRows += sqliteRows.length;
      } catch (tableErr) {
        console.warn(`! Table [${table}] transfer notice: ${tableErr.message}`);
      }
    }

    // Re-enable foreign key checks
    await mysqlDb.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('====================================================');
    console.log(`🎉 MIGRATION COMPLETED! Total rows migrated: ${totalMigratedRows}`);
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
