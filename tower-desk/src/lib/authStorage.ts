import { User } from './types';
import { normalizeUserFromApi } from './userAccess';

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

const normalizePersistedUser = (value: unknown): User | null => {
    if (!isRecord(value)) return null;
    const normalized = normalizeUserFromApi(value);
    if (!normalized) return null;
    return {
        ...normalized,
        roleKeys: normalizeStringArray(value.roleKeys ?? normalized.roleKeys),
        orgRoleKeys: normalizeStringArray(value.orgRoleKeys ?? normalized.orgRoleKeys),
        effectivePermissions: normalizeStringArray(value.effectivePermissions ?? normalized.effectivePermissions),
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
