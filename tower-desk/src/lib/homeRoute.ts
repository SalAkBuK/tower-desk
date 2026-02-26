import type { BaseRole, User } from './types';
import { logAuth } from './debugAuth';
import { resolvePortalRoute } from './portalRoute';

export function getDefaultHomeRoute(user?: User | null, baseRoleOverride?: BaseRole) {
    const baseRole = baseRoleOverride ?? user?.baseRole;
    let route = '/403';
    if (!baseRole) {
        route = '/login';
    } else if (baseRole === 'superadmin') {
        route = '/sa/orgs';
    } else {
        const resolution = resolvePortalRoute({ user, baseRole });
        route = resolution.destination === '/403' ? '/403' : '/portal';
    }

    logAuth('HOME', `resolve role=${baseRole ?? 'none'} -> ${route}`, {
        orgId: user?.orgId ?? null,
        roleKeys: user?.roleKeys ?? [],
        orgRoleKeys: user?.orgRoleKeys ?? []
    });
    return route;
}
