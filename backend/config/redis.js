const redis = require('redis');
require('dotenv').config();

// Redis client configuration
const redisClient = process.env.REDIS_HOST ? redis.createClient({
  url: `redis://${process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : ''}${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
}) : null;

if (redisClient) {
  // Redis event handlers
  redisClient.on('connect', () => {
    console.log('Connected to Redis');
  });

  redisClient.on('ready', () => {
    console.log('Redis client ready');
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  redisClient.on('end', () => {
    console.log('Redis connection ended');
  });
}

// Connect to Redis
const connectRedis = async () => {
  if (!redisClient) return;
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (err) {
    console.error('Redis connection failed (non-fatal):', err.message);
  }
};



// Helper functions for Redis operations
const setCache = async (key, value, expireInSeconds = null) => {
  if (!redisClient.isOpen) return;
  try {
    if (expireInSeconds) {
      await redisClient.setEx(key, expireInSeconds, JSON.stringify(value));
    } else {
      await redisClient.set(key, JSON.stringify(value));
    }
  } catch (err) {
    console.error('Redis set error:', err);
  }
};

const getCache = async (key) => {
  if (!redisClient.isOpen) return null;
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('Redis get error:', err);
    return null;
  }
};

const deleteCache = async (key) => {
  if (!redisClient.isOpen) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error('Redis delete error:', err);
  }
};

const setHash = async (key, field, value) => {
  if (!redisClient.isOpen) return;
  try {
    await redisClient.hSet(key, field, JSON.stringify(value));
  } catch (err) {
    console.error('Redis hSet error:', err);
  }
};

const getHash = async (key, field) => {
  if (!redisClient.isOpen) return null;
  try {
    const value = await redisClient.hGet(key, field);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('Redis hGet error:', err);
    return null;
  }
};

module.exports = {
  redisClient,
  connectRedis,
  setCache,
  getCache,
  deleteCache,
  setHash,
  getHash,
};