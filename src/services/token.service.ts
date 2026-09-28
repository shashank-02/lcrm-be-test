import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessPayload {
  sub: string;
  org: string;
  role: string;
  type: 'access';
}

export function signAccessToken(userId: string, orgId: string, role: string) {
  const payload: AccessPayload = { sub: userId, org: orgId, role, type: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
  if (decoded.type !== 'access') throw new Error('Invalid token type');
  return decoded;
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export function signRefreshToken(userId: string) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti, type: 'refresh' } as RefreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as SignOptions);
  const decoded = jwt.decode(token) as { exp: number };
  return { token, jti, expiresAt: new Date(decoded.exp * 1000) };
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
  if (decoded.type !== 'refresh') throw new Error('Invalid token type');
  return decoded;
}

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
