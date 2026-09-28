import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../common/http';
import { notFound } from '../../common/errors';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/auth';
import { Organisation } from '../../models';

export const organisationRouter = Router();

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
  branding: z.object({ logoUrl: z.string().url().or(z.literal('')).optional(), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).optional(),
  settings: z
    .object({
      defaultRowsPerPage: z.number().int().refine((n) => [25, 50, 100, 200].includes(n)).optional(),
      workingHours: z.object({ start: z.string(), end: z.string() }).optional(),
      workingDays: z.array(z.number().int().min(0).max(6)).optional(),
      defaultFollowUpHours: z.number().int().min(1).max(720).optional(),
      duplicatePhoneCheck: z.boolean().optional(),
    })
    .optional(),
});

organisationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const org = await Organisation.findById(req.user!.orgId);
    if (!org) throw notFound('Organisation');
    ok(res, org.toJSON());
  }),
);

organisationRouter.patch(
  '/',
  requirePermission('admin.settings'),
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const org = await Organisation.findById(req.user!.orgId);
    if (!org) throw notFound('Organisation');
    org.set(req.body);
    await org.save();
    ok(res, org.toJSON());
  }),
);
