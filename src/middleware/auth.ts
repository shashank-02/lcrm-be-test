import type { RequestHandler } from 'express';
import { unauthorized, forbidden } from '../common/errors';
import { verifyAccessToken } from '../services/token.service';
import { buildAuthUser } from '../services/permission.service';
import type { Role } from '../common/types';

/** Verifies the bearer token and attaches `req.user` with resolved permissions. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    const payload = verifyAccessToken(header.slice(7));
    const user = await buildAuthUser(payload.sub);
    if (!user) throw unauthorized('Session is no longer valid');
    req.user = user;
    next();
  } catch (err) {
    next(err instanceof Error && err.name !== 'AppError' ? unauthorized('Invalid or expired token') : err);
  }
};

/** Requires at least one of the listed permissions. Admins always pass. */
export const requirePermission =
  (...keys: string[]): RequestHandler =>
  (req, _res, next) => {
    const user = req.user;
    if (!user) return next(unauthorized());
    if (user.role === 'admin' || keys.some((k) => user.permissions.has(k))) return next();
    return next(forbidden(`Missing permission: ${keys.join(' or ')}`));
  };

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (roles.includes(req.user.role)) return next();
    return next(forbidden());
  };

export const hasPermission = (user: { role: Role; permissions: Set<string> }, key: string) =>
  user.role === 'admin' || user.permissions.has(key);
