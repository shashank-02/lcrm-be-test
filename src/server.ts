import http from 'node:http';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDb, disconnectDb } from './config/db';
import { createApp } from './app';

async function main() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  server.keepAliveTimeout = 65_000;
  server.listen(env.PORT, () => logger.info(`API listening on :${env.PORT} (${env.NODE_ENV})`));

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => { await disconnectDb(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
}

main().catch((err) => { logger.error({ err }, 'Failed to start'); process.exit(1); });
