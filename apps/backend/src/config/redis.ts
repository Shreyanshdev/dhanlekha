import { createClient } from 'redis';
import env from './env';

let redisClient = null;

async function connectRedis() {
  try {
    redisClient = createClient({
      socket: {
        host: env.redis.host,
        port: env.redis.port,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.warn('[Redis] Max retries reached — running without Redis');
            return false; // Stop retrying
          }
          return Math.min(retries * 500, 3000);
        },
      },
    });

    redisClient.on('error', () => {
      // Suppress repeated error logs — handled by reconnectStrategy
    });

    redisClient.on('connect', () => {
      console.log(`[Redis] Connected at ${env.redis.host}:${env.redis.port}`);
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.warn('[Redis] Not available — running without cache (this is OK in development)');
    redisClient = null;
    return null;
  }
}

function getRedisClient() {
  return redisClient;
}

export { connectRedis, getRedisClient };
