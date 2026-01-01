import type { User } from './types';
import { logAuth } from './debugAuth';

export function getDefaultHomeRoute(user?: User | null) {
    const role = user?.role;
    let route = '/403';
    if (!role) {
        route = '/login';
    } else if (role === 'superadmin') {
        route = '/sa/buildings';
    } else if (role === 'admin' || role === 'org_admin') {
        route = '/admin/requests';
    } else if (role === 'manager') {
        route = '/manager/requests';
    }

    logAuth('HOME', `resolve role=${role ?? 'none'} -> ${route}`, {
        orgId: user?.orgId ?? null,
        roleKeys: user?.roleKeys ?? [],
        orgRoleKeys: user?.orgRoleKeys ?? []
    });
    return route;
}
