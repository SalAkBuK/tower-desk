import type { Role, User } from './types';
import { logAuth } from './debugAuth';
import { getUserPermissionSet, hasAnyPermission } from './permissions';

const managerRoutes = [
    { href: '/manager/requests', rule: { prefixes: ['requests'] } },
    { href: '/manager/buildings', rule: { prefixes: ['buildings'] } },
    { href: '/manager/users', rule: { prefixes: ['users'] } },
    { href: '/manager/residents', rule: { prefixes: ['residents'] } },
    { href: '/manager/occupancy', rule: { prefixes: ['occupancy'] } },
    { href: '/manager/owners', rule: { prefixes: ['owners'] } },
    { href: '/manager/access', rule: { prefixes: ['roles', 'users', 'building.assignments'] } },
    { href: '/manager/permissions', rule: { prefixes: ['roles'] } },
];

export function getDefaultHomeRoute(user?: User | null, roleOverride?: Role) {
    const role = roleOverride ?? user?.role;
    let route = '/403';
    if (!role) {
        route = '/login';
    } else if (role === 'superadmin') {
        route = '/sa/orgs';
    } else if (role === 'admin' || role === 'org_admin') {
        route = '/admin/requests';
    } else if (role === 'manager') {
        const permissionSet = getUserPermissionSet(user);
        const matched = managerRoutes.find((entry) => hasAnyPermission(permissionSet, entry.rule));
        route = matched?.href ?? '/manager/requests';
    }

    logAuth('HOME', `resolve role=${role ?? 'none'} -> ${route}`, {
        orgId: user?.orgId ?? null,
        roleKeys: user?.roleKeys ?? [],
        orgRoleKeys: user?.orgRoleKeys ?? []
    });
    return route;
}
