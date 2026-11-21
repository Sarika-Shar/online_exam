const Redis = require('ioredis');
const logger = require('../utils/logger');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

let redisClient;
let isRedisAvailable = false;

// Fallback in-memory cache if Redis server is not running
const memoryCache = new Map();

try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null // don't hang if no Redis
  });

  redisClient.connect().then(() => {
    isRedisAvailable = true;
    logger.info('Connected to Redis successfully.');
  }).catch((err) => {
    logger.warn('Redis connection failed. Switching to built-in in-memory cache fallback:', err.message);
  });

  redisClient.on('error', (err) => {
    if (isRedisAvailable) {
      logger.error('Redis error occurred:', err.message);
    }
  });
} catch (err) {
  logger.warn('Could not initialize Redis client, using in-memory cache:', err.message);
}

// Unified caching helper
const cache = {
  async get(key) {
    if (isRedisAvailable && redisClient) {
      try {
        const val = await redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch {
        // fallback to memory
      }
    }
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return item.value;
  },

  async set(key, value, ttlSeconds = 300) {
    if (isRedisAvailable && redisClient) {
      try {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch {
        // fallback to memory
      }
    }
    memoryCache.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null
    });
  },

  async del(key) {
    if (isRedisAvailable && redisClient) {
      try {
        await redisClient.del(key);
      } catch {
        // fallback
      }
    }
    memoryCache.delete(key);
  },

  async clear() {
    if (isRedisAvailable && redisClient) {
      try {
        await redisClient.flushdb();
      } catch {
        // fallback
      }
    }
    memoryCache.clear();
  }
};

module.exports = {
  redisClient,
  cache
};
