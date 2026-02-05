import { User, BaseRole } from './types';

export type AuthStatus = 'unknown' | 'restoring' | 'authenticated' | 'unauthenticated';

export const AUTH_STORAGE_KEY = 'auth-storage';
export const AUTH_STORAGE_VERSION = 1;

export type PersistedAuthState = {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    selectedOrgId: string | null;
    selectedBuildingId: string | null;
};

export type PersistedAuthEnvelope = {
    state: PersistedAuthState;
    version: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const readNullableString = (value: unknown): string | null | undefined => {
    if (value === null) return null;
    if (typeof value === 'string') return value;
    return undefined;
};

const normalizeStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    return value.map((entry) => String(entry));
};

const normalizeBaseRole = (value: unknown): BaseRole | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.toLowerCase().replace(/[\s-_]/g, '');
    if (['superadmin', 'super', 'superuser', 'platformadmin', 'platform', 'root', 'towerdesk'].includes(normalized)) {
        return 'superadmin';
    }
    if (['orgadmin', 'organizationadmin', 'orgowner'].includes(normalized)) {
        return 'org_admin';
    }
    if (['admin', 'owner', 'buildingadmin', 'buildingadministrator'].includes(normalized)) {
        return 'admin';
    }
    if (['manager', 'buildingmanager'].includes(normalized)) {
        return 'manager';
    }
    if (['serviceprovider', 'service_provider'].includes(normalized)) {
        return 'service_provider';
    }
    if (['employee', 'staff', 'maintenance', 'maintenancestaff', 'technician', 'worker'].includes(normalized)) {
        return 'employee';
    }
    if (['tenant', 'resident', 'occupant'].includes(normalized)) {
        return 'tenant';
    }
    return undefined;
};

const normalizePersistedUser = (value: unknown): User | null => {
    if (!isRecord(value)) return null;
    const rawId = (value as { id?: unknown; userId?: unknown }).id ?? (value as { userId?: unknown }).userId;
    if (rawId === undefined || rawId === null || String(rawId).trim() === '') return null;

    const email = typeof value.email === 'string' ? value.email : '';
    const fullName = typeof value.fullName === 'string' ? value.fullName : undefined;
    const name = typeof value.name === 'string'
        ? value.name
        : (fullName || (email ? email.split('@')[0] : 'User'));

    const role = typeof value.role === 'string'
        ? value.role
        : (typeof value.baseRole === 'string' ? value.baseRole : undefined);
    if (!role) return null;
    const baseRole = normalizeBaseRole(value.baseRole) ?? normalizeBaseRole(role);

    return {
        ...(value as User),
        id: String(rawId),
        email,
        name,
        fullName,
        role,
        baseRole,
        buildingIds: Array.isArray(value.buildingIds) ? value.buildingIds.map((id) => String(id)) : [],
        orgId: typeof value.orgId === 'string' ? value.orgId : (value.orgId === null ? null : undefined),
        roleKeys: normalizeStringArray(value.roleKeys),
        orgRoleKeys: normalizeStringArray(value.orgRoleKeys),
        effectivePermissions: normalizeStringArray(value.effectivePermissions),
        phoneNumber: typeof value.phoneNumber === 'string' ? value.phoneNumber : undefined,
        address: typeof value.address === 'string' ? value.address : undefined,
        nationality: typeof value.nationality === 'string' ? value.nationality : undefined,
        avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
        isActive: typeof value.isActive === 'boolean' ? value.isActive : undefined,
        createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined
    };
};

export const sanitizePersistedAuthState = (value: unknown): PersistedAuthState | null => {
    if (!isRecord(value)) return null;
    if (!Object.prototype.hasOwnProperty.call(value, 'token')
        || !Object.prototype.hasOwnProperty.call(value, 'refreshToken')
        || !Object.prototype.hasOwnProperty.call(value, 'user')) {
        return null;
    }

    const token = readNullableString(value.token);
    const refreshToken = readNullableString(value.refreshToken);
    if (token === undefined || refreshToken === undefined) return null;

    let user: User | null = null;
    if (value.user === null) {
        user = null;
    } else {
        user = normalizePersistedUser(value.user);
        if (!user) return null;
    }

    const selectedOrgId = readNullableString(value.selectedOrgId);
    const selectedBuildingId = readNullableString(value.selectedBuildingId);

    return {
        user,
        token,
        refreshToken,
        selectedOrgId: selectedOrgId ?? null,
        selectedBuildingId: selectedBuildingId ?? null
    };
};

export const parseAuthStorageValue = (raw: string): PersistedAuthEnvelope | null => {
    try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed)) return null;
        if (typeof parsed.version !== 'number') return null;
        const state = sanitizePersistedAuthState(parsed.state);
        if (!state) return null;
        return { version: parsed.version, state };
    } catch {
        return null;
    }
};

export const deriveAuthStatus = (state: Pick<PersistedAuthState, 'token' | 'user'>): AuthStatus => {
    if (!state.token) return 'unauthenticated';
    if (!state.user) return 'restoring';
    return 'authenticated';
};
