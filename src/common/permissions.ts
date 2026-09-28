import type { Role } from './types';

/**
 * Single source of truth for feature permissions.
 * Keys are stored in permission templates; the frontend mirrors this catalogue.
 */
export const PERMISSION_CATALOGUE = {
  Leads: {
    'lead.view': 'View leads',
    'lead.create': 'Create lead',
    'lead.edit': 'Edit lead details',
    'lead.delete': 'Delete lead',
    'lead.assign': 'Assign / reassign owner',
    'lead.update_stage': 'Update stage',
    'lead.update_status': 'Update status',
    'lead.update_source': 'Update source',
    'lead.reset_followup': 'Reset follow-up',
    'lead.export': 'Export leads (CSV)',
    'lead.import': 'Bulk import leads',
    'lead.erase_history': 'Erase history when reassigning',
    'lead.communicate': 'WhatsApp / Email / Call',
  },
  'Bulk actions': {
    'lead.bulk_assign': 'Bulk assign',
    'lead.bulk_update': 'Bulk update stage / status / source / field',
    'lead.bulk_delete': 'Bulk delete',
    'lead.bulk_communicate': 'Bulk WhatsApp / Email templates',
  },
  Activities: {
    'activity.view': 'View activity timeline',
    'note.view': 'View notes',
    'note.create': 'Add notes',
    'note.edit': 'Edit notes',
    'note.delete': 'Delete notes',
    'task.view': 'View tasks',
    'task.create': 'Create tasks',
    'task.edit': 'Edit / complete tasks',
    'task.delete': 'Delete tasks',
    'call.view': 'View call logs',
    'call.create': 'Log calls',
    'file.view': 'View documents',
    'file.upload': 'Upload documents',
    'file.delete': 'Delete documents',
  },
  Reports: {
    'report.view_own': 'Own performance',
    'report.view_team': 'Team reports',
    'report.view_org': 'Organisation-wide reports',
  },
  Administration: {
    'admin.settings': 'Organisation settings',
    'admin.users': 'Manage users',
    'admin.teams': 'Manage teams',
    'admin.permissions': 'Manage permission templates',
    'admin.pipeline': 'Manage stages, statuses, sources, directives',
    'admin.fields': 'Manage lead fields & views',
    'admin.templates': 'Manage message templates',
    'admin.assignment_rules': 'Manage assignment rules',
    'admin.imports': 'View all import history',
  },
} as const;

export type PermissionKey = {
  [G in keyof typeof PERMISSION_CATALOGUE]: keyof (typeof PERMISSION_CATALOGUE)[G];
}[keyof typeof PERMISSION_CATALOGUE];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSION_CATALOGUE).flatMap(
  (g) => Object.keys(g) as PermissionKey[],
);

export const isPermissionKey = (k: string): k is PermissionKey => (ALL_PERMISSIONS as string[]).includes(k);

const agentBase: PermissionKey[] = [
  'lead.view', 'lead.create', 'lead.edit', 'lead.update_stage', 'lead.update_status', 'lead.communicate',
  'activity.view', 'note.view', 'note.create', 'note.edit', 'task.view', 'task.create', 'task.edit',
  'call.view', 'call.create', 'file.view', 'file.upload', 'report.view_own',
];

const teamLeadBase: PermissionKey[] = [
  ...agentBase, 'lead.assign', 'lead.update_source', 'lead.reset_followup', 'lead.bulk_update',
  'lead.bulk_communicate', 'lead.bulk_assign', 'note.delete', 'task.delete', 'file.delete', 'report.view_team',
];

const managerBase: PermissionKey[] = [
  ...teamLeadBase, 'lead.delete', 'lead.export', 'lead.import', 'lead.bulk_delete', 'lead.erase_history',
];

/** Default (system) permission templates seeded per role. Admin has every permission implicitly. */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  admin: ALL_PERMISSIONS,
  branch_manager: Array.from(new Set(managerBase)),
  team_lead: Array.from(new Set(teamLeadBase)),
  agent: agentBase,
};
