import { Router } from 'express';
import { asyncHandler, ok } from '../common/http';
import { normalise } from '../common/crud';
import { PERMISSION_CATALOGUE } from '../common/permissions';
import { ROLE_LABELS } from '../common/types';
import { FieldDefinition, ListView, MessageTemplate, Organisation, Source, Stage, StageDirective, Status, Team } from '../models';
import { assignableUsers, visibleTeamIds } from '../services/scope.service';

export const bootstrapRouter = Router();

/** Everything the SPA needs after login, in one round-trip. */
bootstrapRouter.get('/', asyncHandler(async (req, res) => {
  const orgId = req.user!.orgId;
  const teamFilter: Record<string, unknown> = { orgId, isActive: true };
  const visible = visibleTeamIds(req.user!);
  if (visible) teamFilter._id = { $in: visible };
  const [org, stages, statuses, sources, fields, templates, directives, views, users, teams] = await Promise.all([
    Organisation.findById(orgId).lean(),
    Stage.find({ orgId, isActive: true }).sort({ order: 1 }).lean(),
    Status.find({ orgId, isActive: true }).sort({ order: 1 }).lean(),
    Source.find({ orgId, isActive: true }).sort({ name: 1 }).lean(),
    FieldDefinition.find({ orgId, isActive: true }).sort({ tab: 1, section: 1, order: 1 }).lean(),
    MessageTemplate.find({ orgId, isActive: true }).sort({ channel: 1, name: 1 }).lean(),
    StageDirective.find({ orgId, isActive: true }).lean(),
    ListView.find({ orgId, $or: [{ userId: null }, { userId: req.user!.id }] }).sort({ order: 1 }).lean(),
    assignableUsers(req.user!),
    Team.find(teamFilter).sort({ name: 1 }).lean(),
  ]);
  ok(res, {
    org: org ? normalise(org) : null,
    stages: stages.map(normalise), statuses: statuses.map(normalise), sources: sources.map(normalise),
    fields: fields.map(normalise), templates: templates.map(normalise), directives: directives.map(normalise),
    views: views.map(normalise), users: users.map(normalise), teams: teams.map(normalise),
    permissionCatalogue: PERMISSION_CATALOGUE, roles: ROLE_LABELS,
  });
}));
