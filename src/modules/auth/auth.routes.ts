import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { asyncHandler, ok } from '../../common/http';
import { unauthorized, badRequest } from '../../common/errors';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { Session, User, Organisation } from '../../models';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../services/token.service';
import { buildAuthUser } from '../../services/permission.service';
import { PERMISSION_CATALOGUE } from '../../common/permissions';
import { ROLE_LABELS } from '../../common/types';
import { isTest } from '../../config/env';

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: isTest ? 1000 : 20, standardHeaders: true, legacyHeaders: false });

const loginSchema = z.object({
  /** email, phone or username */
  identifier: z.string().min(2).max(120),
  password: z.string().min(1).max(200),
});

async function issueTokens(user: { _id: unknown; orgId: unknown; role: string }, meta: { ua?: string; ip?: string }) {
  const accessToken = signAccessToken(String(user._id), String(user.orgId), user.role);
  const refresh = signRefreshToken(String(user._id));
  await Session.create({ userId: user._id, tokenHash: hashToken(refresh.token), expiresAt: refresh.expiresAt, userAgent: meta.ua ?? '', ip: meta.ip ?? '' });
  return { accessToken, refreshToken: refresh.token, expiresAt: refresh.expiresAt };
}

authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const identifier = String(req.body.identifier).trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }, { phone: identifier }],
    });
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw unauthorized('Invalid credentials');
    if (!user.isActive) throw unauthorized('Your account has been deactivated. Contact your admin.');
    const org = await Organisation.findById(user.orgId).select('isActive').lean();
    if (!org?.isActive) throw unauthorized('Organisation is inactive');

    user.lastLoginAt = new Date();
    await user.save();
    const tokens = await issueTokens(user, { ua: req.headers['user-agent'], ip: req.ip });
    const me = await buildAuthUser(String(user._id));
    ok(res, { ...tokens, user: serializeMe(me!, user.mustChangePassword) });
  }),
);

authRouter.post(
  '/refresh',
  validate({ body: z.object({ refreshToken: z.string().min(10) }) }),
  asyncHandler(async (req, res) => {
    const token: string = req.body.refreshToken;
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw unauthorized('Refresh token invalid or expired');
    }
    const session = await Session.findOne({ tokenHash: hashToken(token), revokedAt: null });
    if (!session || session.expiresAt < new Date()) throw unauthorized('Session expired, please sign in again');
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw unauthorized('Account unavailable');
    // Rotate: revoke the old session and issue a new pair.
    session.revokedAt = new Date();
    await session.save();
    const tokens = await issueTokens(user, { ua: req.headers['user-agent'], ip: req.ip });
    ok(res, tokens);
  }),
);

authRouter.post(
  '/logout',
  validate({ body: z.object({ refreshToken: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    if (req.body.refreshToken) await Session.updateOne({ tokenHash: hashToken(req.body.refreshToken) }, { $set: { revokedAt: new Date() } });
    ok(res, { loggedOut: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.user!.id).select('mustChangePassword phone username avatarColor').lean();
    ok(res, serializeMe(req.user!, u?.mustChangePassword ?? false, u));
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) }) }),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user || !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect');
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    user.mustChangePassword = false;
    await user.save();
    // Sign out other devices
    await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    ok(res, { changed: true });
  }),
);

authRouter.get('/permission-catalogue', requireAuth, (_req, res) => ok(res, { catalogue: PERMISSION_CATALOGUE, roles: ROLE_LABELS }));

function serializeMe(me: NonNullable<Awaited<ReturnType<typeof buildAuthUser>>>, mustChangePassword: boolean, extra?: { phone?: string; username?: string; avatarColor?: string } | null) {
  return {
    id: me.id, orgId: me.orgId, name: me.name, email: me.email, role: me.role, teamId: me.teamId,
    managedTeamIds: me.managedTeamIds, permissions: Array.from(me.permissions), timezone: me.timezone,
    mustChangePassword, phone: extra?.phone, username: extra?.username, avatarColor: extra?.avatarColor,
  };
}
