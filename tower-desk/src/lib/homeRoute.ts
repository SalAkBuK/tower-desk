import type { BaseRole, User } from './types';
import { logAuth } from './debugAuth';
import { getUserPermissionSet, hasAnyPermission } from './permissions';

const managerRoutes = [
    { href: '/manager/messages', rule: { prefixes: ['messaging'] } },
    { href: '/manager/broadcasts', rule: { prefixes: ['broadcasts'] } },
    { href: '/manager/requests', rule: { prefixes: ['requests'] } },
    { href: '/manager/buildings', rule: { prefixes: ['buildings'] } },
    { href: '/manager/users', rule: { prefixes: ['users'] } },
    { href: '/manager/residents', rule: { prefixes: ['residents'] } },
    { href: '/manager/occupancy', rule: { prefixes: ['occupancy'] } },
    { href: '/manager/owners', rule: { prefixes: ['owners'] } },
    { href: '/manager/access', rule: { prefixes: ['roles', 'users', 'building.assignments'] } },
    { href: '/manager/permissions', rule: { prefixes: ['roles'] } },
];

const adminRoutes = [
    { href: '/admin/messages', rule: { prefixes: ['messaging'] } },
    { href: '/admin/broadcasts', rule: { prefixes: ['broadcasts'] } },
    { href: '/admin/requests', rule: { prefixes: ['requests'] } },
    { href: '/admin/buildings', rule: { prefixes: ['buildings'] } },
    { href: '/admin/users', rule: { prefixes: ['users'] } },
    { href: '/admin/residents', rule: { prefixes: ['residents'] } },
    { href: '/admin/occupancy', rule: { prefixes: ['occupancy'] } },
    { href: '/admin/owners', rule: { prefixes: ['owners'] } },
    { href: '/admin/access', rule: { prefixes: ['roles', 'users', 'building.assignments'] } },
    { href: '/admin/permissions', rule: { prefixes: ['roles'] } },
    { href: '/admin/units', rule: { prefixes: ['units', 'buildings'] } },
    { href: '/admin/parking', rule: { prefixes: ['parkingSlots', 'parkingAllocations', 'vehicles'] } },
    { href: '/admin/reports', rule: { prefixes: ['reports'] } },
];

export function getDefaultHomeRoute(user?: User | null, baseRoleOverride?: BaseRole) {
    const baseRole = baseRoleOverride ?? user?.baseRole;
    let route = '/403';
    if (!baseRole) {
        route = '/login';
    } else if (baseRole === 'superadmin') {
        route = '/sa/orgs';
    } else {
        const permissionSet = getUserPermissionSet(user);
        const routes = baseRole === 'manager' ? managerRoutes : adminRoutes;
        const matched = routes.find((entry) => hasAnyPermission(permissionSet, entry.rule));
        route = matched?.href ?? '/403';
    }

    logAuth('HOME', `resolve role=${baseRole ?? 'none'} -> ${route}`, {
        orgId: user?.orgId ?? null,
        roleKeys: user?.roleKeys ?? [],
        orgRoleKeys: user?.orgRoleKeys ?? []
    });
    return route;
}
