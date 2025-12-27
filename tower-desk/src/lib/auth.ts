import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Role } from './types';
import { useEffect } from 'react';

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    selectedBuildingId: string | null;
    isAuthenticated: boolean;
    login: (user: User, token?: string | null, refreshToken?: string | null) => void;
    setSelectedBuildingId: (buildingId: string | null) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            refreshToken: null,
            selectedBuildingId: null,
            isAuthenticated: false,
            login: (user, token, refreshToken) =>
                set((state) => ({
                    user,
                    token: token !== undefined ? token : state.token,
                    refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
                    isAuthenticated: true
                })),
            setSelectedBuildingId: (buildingId) => set({ selectedBuildingId: buildingId }),
            logout: () => set({ user: null, token: null, refreshToken: null, selectedBuildingId: null, isAuthenticated: false }),
        }),
        {
            name: 'auth-storage',
        }
    )
);

export function useAuth() {
    const { user, token, refreshToken, selectedBuildingId, isAuthenticated, login, setSelectedBuildingId, logout } = useAuthStore();

    const role = user?.role ?? (user ? (user.orgId ? 'manager' : 'superadmin') : undefined);
    const buildingScope = user?.buildingIds || [];

    useEffect(() => {
        if (user && !user.role && role) {
            useAuthStore.setState({ user: { ...user, role } });
        }
    }, [user, role]);

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
        selectedBuildingId,
        token,
        refreshToken,
        isAuthenticated,
        login,
        setSelectedBuildingId,
        logout,
        can,
    };
}
