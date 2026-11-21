const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const dialect = process.env.DB_DIALECT || (process.env.DB_HOST ? 'mysql' : 'sqlite');
let sequelize;

const commonOptions = {
  define: {
    underscored: true,
    timestamps: true
  },
  logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
  pool: {
    max: dialect === 'sqlite' ? 1 : parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: dialect === 'sqlite' ? 1 : parseInt(process.env.DB_POOL_MIN || '2', 10),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10)
  }
};

if (dialect === 'sqlite') {
  const storagePath = process.env.DB_STORAGE 
    ? (path.isAbsolute(process.env.DB_STORAGE) ? process.env.DB_STORAGE : path.resolve(__dirname, '../../', process.env.DB_STORAGE))
    : path.resolve(__dirname, '../../database.sqlite');
    
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    retry: {
      match: [
        /SQLITE_BUSY/,
        /database is locked/
      ],
      max: 10
    },
    ...commonOptions
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'online_exam_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      dialect: 'mysql',
      ...commonOptions
    }
  );
}

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    if (dialect === 'sqlite') {
      await sequelize.query('PRAGMA journal_mode = WAL;');
      await sequelize.query('PRAGMA busy_timeout = 15000;');
    }
    logger.info(`Database connected successfully using [${dialect.toUpperCase()}] dialect.`);
  } catch (error) {
    logger.error(`Unable to connect to the database (${dialect}):`, error.message);
    if (dialect === 'mysql') {
      logger.warn('Hint: If MySQL is not running yet, you can set DB_DIALECT=sqlite in backend/.env for instant local testing.');
    }
    throw error;
  }
};

module.exports = {
  sequelize,
  testConnection
};
