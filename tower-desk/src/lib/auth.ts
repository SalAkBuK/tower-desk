import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Role } from './types';

interface AuthState {
    user: User | null;
    token: string | null;
    selectedBuildingId: string | null;
    isAuthenticated: boolean;
    login: (user: User, token?: string | null) => void;
    setSelectedBuildingId: (buildingId: string | null) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            selectedBuildingId: null,
            isAuthenticated: false,
            login: (user, token) => set({ user, token: token || null, isAuthenticated: true }),
            setSelectedBuildingId: (buildingId) => set({ selectedBuildingId: buildingId }),
            logout: () => set({ user: null, token: null, selectedBuildingId: null, isAuthenticated: false }),
        }),
        {
            name: 'auth-storage',
        }
    )
);

export function useAuth() {
    const { user, token, selectedBuildingId, isAuthenticated, login, setSelectedBuildingId, logout } = useAuthStore();

    const role = user?.role;
    const buildingScope = user?.buildingIds || [];

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
        isAuthenticated,
        login,
        setSelectedBuildingId,
        logout,
        can,
    };
}
