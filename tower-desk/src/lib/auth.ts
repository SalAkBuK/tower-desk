import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, BaseRole } from './types';
import { useEffect, useRef } from 'react';
import { logAuth } from './debugAuth';
import { getUserPermissionSet } from './permissions';
import { toCanonicalRole } from './roles';
import { getBuildingAccessAssignments } from './userAccess';
import {
    AuthStatus,
    AUTH_STORAGE_KEY,
    AUTH_STORAGE_VERSION,
    deriveAuthStatus,
    parseAuthStorageValue,
    sanitizePersistedAuthState,
    PersistedAuthState
} from './authStorage';

const normalizeRole = (value?: string): BaseRole | undefined => toCanonicalRole(value);

const decodeJwtPayload = (token?: string | null): Record<string, any> | null => {
    if (!token) return null;
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = typeof atob === 'function'
            ? atob(normalized)
            : Buffer.from(normalized, 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
};

const getRoleFromToken = (token?: string | null): BaseRole | undefined => {
    const payload = decodeJwtPayload(token);
    if (!payload) return undefined;
    const direct = normalizeRole(payload.role);
    if (direct) return direct;
    if (Array.isArray(payload.roles)) {
        for (const entry of payload.roles) {
            const mapped = normalizeRole(entry);
            if (mapped) return mapped;
        }
    }
    return undefined;
};

export const clearAuthStorage = () => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
        // ignore
    }
};

const buildAuthMeta = (token: string | null, user: User | null) => {
    const status = deriveAuthStatus({ token, user });
    return {
        status,
        isAuthenticated: status === 'authenticated',
        permissionsReady: status === 'authenticated' && Boolean(user),
    };
};

const getLoggedOutPersistedState = (): PersistedAuthState => ({
    user: null,
    token: null,
    refreshToken: null,
    selectedOrgId: null,
    selectedBuildingId: null
});

const getLoggedOutState = (): Pick<AuthState, 'user' | 'token' | 'refreshToken' | 'selectedOrgId' | 'selectedBuildingId' | 'status' | 'hydrated' | 'isAuthenticated' | 'permissionsReady'> => ({
    user: null,
    token: null,
    refreshToken: null,
    selectedOrgId: null,
    selectedBuildingId: null,
    status: 'unauthenticated',
    hydrated: true,
    isAuthenticated: false,
    permissionsReady: false
});

const getApiBaseUrl = () => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) return null;
    return base.replace(/\/+$/, '');
};

const requestServerLogout = async (token?: string | null) => {
    if (!token) return;
    if (typeof window === 'undefined') return;
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) return;
    try {
        await fetch(`${apiBaseUrl}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*',
                Authorization: `Bearer ${token}`,
            },
        });
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[AUTH] Server logout failed', error);
        }
    }
};

const safeStorage = typeof window === 'undefined'
    ? undefined
    : {
        getItem: (name: string) => {
            try {
                const raw = window.localStorage.getItem(name);
                if (!raw) return null;
                const parsed = parseAuthStorageValue(raw);
                if (!parsed) {
                    window.localStorage.removeItem(name);
                    return null;
                }
                return parsed;
            } catch {
                try {
                    window.localStorage.removeItem(name);
                } catch {
                    // ignore
                }
                return null;
            }
        },
        setItem: (name: string, value: unknown) => {
            window.localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name: string) => {
            window.localStorage.removeItem(name);
        }
    };

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    selectedOrgId: string | null;
    selectedBuildingId: string | null;
    status: AuthStatus;
    hydrated: boolean;
    isAuthenticated: boolean;
    permissionsReady: boolean;
    login: (user: User | null, token?: string | null, refreshToken?: string | null) => void;
    setSelectedOrgId: (orgId: string | null) => void;
    setSelectedBuildingId: (buildingId: string | null) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            refreshToken: null,
            selectedOrgId: null,
            selectedBuildingId: null,
            status: 'unknown',
            hydrated: false,
            isAuthenticated: false,
            permissionsReady: false,
            login: (user, token, refreshToken) =>
                set((state) => {
                    const nextToken = token !== undefined ? token : state.token;
                    const nextRefreshToken = refreshToken !== undefined ? refreshToken : state.refreshToken;
                    if (!user) {
                        const meta = buildAuthMeta(nextToken ?? null, null);
                        return {
                            ...state,
                            user: null,
                            token: nextToken ?? null,
                            refreshToken: nextRefreshToken ?? null,
                            hydrated: true,
                            ...meta,
                            permissionsReady: false
                        };
                    }
                    const prev = state.user;
                    const isSameUser = Boolean(prev?.id && user?.id && prev.id === user.id);
                    if (prev?.role && !user.role) {
                        logAuth('AUTH', 'role_dropped', { prevRole: prev.role, incomingKeys: Object.keys(user) });
                        if (process.env.NODE_ENV !== 'production') {
                            console.warn('[AUTH] role dropped on login merge', { prevRole: prev.role, incoming: user });
                        }
                    }
                    const mergedUser = {
                        ...prev,
                        ...user,
                        role: user.role ?? (isSameUser ? prev?.role : undefined),
                        baseRole: user.baseRole ?? (isSameUser ? prev?.baseRole : undefined)
                    };
                    const meta = buildAuthMeta(nextToken ?? null, mergedUser);
                    return {
                        ...state,
                        user: mergedUser,
                        token: nextToken ?? null,
                        refreshToken: nextRefreshToken ?? null,
                        selectedOrgId: isSameUser ? state.selectedOrgId : null,
                        selectedBuildingId: isSameUser ? state.selectedBuildingId : null,
                        hydrated: true,
                        ...meta,
                        permissionsReady: true
                    };
                }),
            setSelectedOrgId: (orgId) => set({ selectedOrgId: orgId }),
            setSelectedBuildingId: (buildingId) => set({ selectedBuildingId: buildingId }),
            logout: () => {
                const token = useAuthStore.getState().token;
                void requestServerLogout(token);
                set((state) => ({
                    ...state,
                    ...getLoggedOutState()
                }));
                clearAuthStorage();
            },
        }),
        {
            name: AUTH_STORAGE_KEY,
            version: AUTH_STORAGE_VERSION,
            storage: safeStorage,
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                refreshToken: state.refreshToken,
                selectedOrgId: state.selectedOrgId,
                selectedBuildingId: state.selectedBuildingId
            }),
            merge: (persistedState, currentState) => {
                const sanitized = sanitizePersistedAuthState(persistedState);
                if (!sanitized) {
                    if (persistedState !== undefined) {
                        clearAuthStorage();
                    }
                    return {
                        ...currentState,
                        ...getLoggedOutState()
                    };
                }
                const meta = buildAuthMeta(sanitized.token, sanitized.user);
                return {
                    ...currentState,
                    ...sanitized,
                    hydrated: true,
                    ...meta
                };
            },
            migrate: () => getLoggedOutPersistedState(),
            onRehydrateStorage: () => (_state, error) => {
                if (error) {
                    clearAuthStorage();
                    useAuthStore.setState((state) => ({
                        ...state,
                        ...getLoggedOutState()
                    }));
                }
            },
        }
    )
);

export function useAuth() {
    const {
        user,
        token,
        refreshToken,
        selectedOrgId,
        selectedBuildingId,
        isAuthenticated,
        hydrated,
        permissionsReady,
        status,
        login,
        setSelectedOrgId,
        setSelectedBuildingId,
        logout
    } = useAuthStore();

    const baseRoleFromToken = getRoleFromToken(token);
    const baseRole = user?.baseRole ?? baseRoleFromToken ?? normalizeRole(user?.role);
    const role = user?.role ?? baseRole;
    const scopedBuildingIds = getBuildingAccessAssignments(user)
        .map((assignment) => assignment.scopeId)
        .filter((scopeId): scopeId is string => Boolean(scopeId));
    const buildingScope = scopedBuildingIds.length > 0 ? scopedBuildingIds : (user?.buildingIds ?? []);
    const hasToken = Boolean(token);
    const isRestoring = status === 'restoring';

    const fixupUserIdRef = useRef<string | null>(null);
    useEffect(() => {
        // Only run fixup once per user session to prevent infinite loops
        const userId = user?.id;
        if (!userId || fixupUserIdRef.current === userId) return;
        if ((!user?.role || !user?.baseRole) && (role || baseRole)) {
            fixupUserIdRef.current = userId;
            const currentUser = useAuthStore.getState().user;
            if (currentUser) {
                useAuthStore.setState({
                    user: { ...currentUser, role: currentUser.role ?? role, baseRole: currentUser.baseRole ?? baseRole }
                });
            }
        }
    }, [user?.id, user?.role, user?.baseRole, role, baseRole]);

    useEffect(() => {
        if (isRestoring) {
            useAuthStore.setState({ permissionsReady: false });
        }
    }, [isRestoring]);

    const prevStatusRef = useRef<string | null>(null);
    useEffect(() => {
        if (prevStatusRef.current === status) return;
        prevStatusRef.current = status;
        logAuth('STATE', `status=${status} role=${role ?? 'none'}`, {
            userId: user?.id ?? null,
            orgId: user?.orgId ?? null,
            hasToken,
            isAuthenticated
        });
    }, [status, role, user?.id, user?.orgId, hasToken, isAuthenticated]);

    const can = (action: string): boolean => {
        if (!role) return false;
        const permissionSet = getUserPermissionSet(user);
        const normalizedAction = String(action).toLowerCase();
        return permissionSet.has('*') || permissionSet.has(normalizedAction);
    };

    return {
        user,
        role,
        baseRole,
        buildingScope,
        selectedOrgId,
        selectedBuildingId,
        token,
        refreshToken,
        isAuthenticated,
        permissionsReady,
        status,
        hydrated,
        hasToken,
        isRestoring,
        login,
        setSelectedOrgId,
        setSelectedBuildingId,
        logout,
        can,
    };
}
