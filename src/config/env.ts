import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/lead_crm'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage'),
  AWS_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  SEED_ORG_NAME: z.string().default('My Company'),
  SEED_ADMIN_NAME: z.string().default('System Admin'),
  SEED_ADMIN_EMAIL: z.string().default('admin@example.com'),
  SEED_ADMIN_PHONE: z.string().default('9999999999'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin@12345'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  MAX_IMPORT_ROWS: z.coerce.number().default(50_000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
