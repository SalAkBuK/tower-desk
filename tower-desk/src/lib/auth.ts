import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Role } from './types';
import { useEffect } from 'react';
import { logAuth } from './debugAuth';

const normalizeRole = (value?: string): Role | undefined => {
    if (!value) return undefined;
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

const getRoleFromToken = (token?: string | null): Role | undefined => {
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

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    selectedOrgId: string | null;
    selectedBuildingId: string | null;
    isAuthenticated: boolean;
    hasHydrated: boolean;
    login: (user: User, token?: string | null, refreshToken?: string | null) => void;
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
            isAuthenticated: false,
            hasHydrated: false,
            login: (user, token, refreshToken) =>
                set((state) => {
                    if (!user) {
                        return {
                            user: null,
                            token: token !== undefined ? token : state.token,
                            refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
                            isAuthenticated: false
                        };
                    }
                    const prev = state.user;
                    if (prev?.role && !user.role) {
                        logAuth('AUTH', 'role_dropped', { prevRole: prev.role, incomingKeys: Object.keys(user) });
                        if (process.env.NODE_ENV !== 'production') {
                            console.warn('[AUTH] role dropped on login merge', { prevRole: prev.role, incoming: user });
                        }
                    }
                    const mergedUser = {
                        ...prev,
                        ...user,
                        role: user.role ?? prev?.role
                    };
                    return {
                        user: mergedUser,
                        token: token !== undefined ? token : state.token,
                        refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
                        isAuthenticated: true
                    };
                }),
            setSelectedOrgId: (orgId) => set({ selectedOrgId: orgId }),
            setSelectedBuildingId: (buildingId) => set({ selectedBuildingId: buildingId }),
            logout: () => set({ user: null, token: null, refreshToken: null, selectedOrgId: null, selectedBuildingId: null, isAuthenticated: false }),
        }),
        {
            name: 'auth-storage',
            onRehydrateStorage: () => () => {
                useAuthStore.setState({ hasHydrated: true });
            },
        }
    )
);

export function useAuth() {
    const { user, token, refreshToken, selectedOrgId, selectedBuildingId, isAuthenticated, hasHydrated, login, setSelectedOrgId, setSelectedBuildingId, logout } = useAuthStore();

    const role = user?.role ?? getRoleFromToken(token);
    const buildingScope = user?.buildingIds || [];
    const hasToken = Boolean(token);
    const hasSession = Boolean(user && token);
    const isRestoring = Boolean(hasToken && !user);
    const status = !hasHydrated ? 'loading' : (isRestoring ? 'restoring' : (hasSession ? 'authenticated' : 'unauthenticated'));

    useEffect(() => {
        if (user && !user.role && role) {
            useAuthStore.setState({ user: { ...user, role } });
        }
    }, [user, role]);

    useEffect(() => {
        if (!hasHydrated) {
            useAuthStore.setState({ hasHydrated: true });
        }
    }, [hasHydrated]);

    useEffect(() => {
        logAuth('STATE', `status=${status} role=${role ?? 'none'}`, {
            userId: user?.id ?? null,
            orgId: user?.orgId ?? null,
            hasToken,
            isAuthenticated
        });
    }, [status, role, user?.id, user?.orgId, hasToken, isAuthenticated]);

    const can = (action: string): boolean => {
        if (!role) return false;

        // Simple RBAC Map
        const permissions: Record<Role, string[]> = {
            superadmin: ['*'], // All permissions
            admin: [
                'manage:users', 'view:users',
                'manage:requests', 'view:requests', 'assign:requests',
                'view:buildings', 'edit:buildings'
            ],
            org_admin: [
                'manage:users', 'view:users',
                'manage:requests', 'view:requests', 'assign:requests',
                'view:buildings', 'edit:buildings'
            ],
            manager: [
                'view:users',
                'view:requests', 'create:requests', 'assign:requests'
            ],
            service_provider: ['view:requests', 'update:requests'],
            employee: ['view:requests', 'update:requests'],
            tenant: ['create:requests', 'view:requests'],
        };

        const userPerms = permissions[role];
        if (userPerms?.includes('*')) return true;
        return userPerms?.includes(action) || false;
    };

    return {
        user,
        role,
        buildingScope,
        selectedOrgId,
        selectedBuildingId,
        token,
        refreshToken,
        isAuthenticated,
        status,
        hasToken,
        isRestoring,
        login,
        setSelectedOrgId,
        setSelectedBuildingId,
        logout,
        can,
    };
}
