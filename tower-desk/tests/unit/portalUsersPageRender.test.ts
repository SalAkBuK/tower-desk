import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalUsersPage } from "../../src/components/users/PortalUsersPage";

let authState: any = {
    user: { id: "user-1", effectivePermissions: ["users.write"], buildingIds: ["building-1"] },
    baseRole: "building_admin",
    login: vi.fn(),
    token: "token-1",
};
let usersData: any[] = [];
let accessibleBuildingsEnabled: boolean | undefined;
let adminUsersEnabled: boolean | undefined;

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/permissions", () => ({
    getUserPermissionSet: (user?: { effectivePermissions?: string[] }) => new Set(user?.effectivePermissions ?? []),
    hasAnyPermission: (permissionSet: Set<string>, options?: { keys?: string[]; prefixes?: string[] }) => {
        const keys = options?.keys ?? [];
        const prefixes = options?.prefixes ?? [];
        for (const key of keys) {
            if (permissionSet.has(String(key).toLowerCase())) return true;
        }
        for (const prefix of prefixes) {
            const normalized = String(prefix).toLowerCase();
            for (const entry of permissionSet) {
                if (entry === normalized || entry.startsWith(`${normalized}.`)) return true;
            }
        }
        return false;
    },
    hasPermission: (permissionSet: Set<string>, key?: string | null) => Boolean(key && permissionSet.has(String(key).toLowerCase())),
    hasPermissionPrefix: (permissionSet: Set<string>, prefix?: string | null) => {
        const normalized = String(prefix ?? "").toLowerCase();
        if (!normalized) return false;
        if (permissionSet.has(normalized)) return true;
        const token = `${normalized}.`;
        for (const entry of permissionSet) {
            if (entry.startsWith(token)) return true;
        }
        return false;
    },
}));

vi.mock("@/lib/portalRegistry", () => ({
    getPortalModuleByKey: (key: string) => {
        if (key === "users") return { rule: { prefixes: ["users"] } };
        return null;
    },
}));

vi.mock("@/components/users/UsersTable", () => ({
    UsersTable: ({ users }: { users?: unknown[] }) => createElement("div", {}, `rows:${users?.length ?? 0}`),
}));

vi.mock("@/components/users/CreateUserSheet", () => ({
    CreateUserSheet: () => null,
}));

vi.mock("@/lib/queries", () => ({
    useAccessibleBuildings: (_userId?: string, _baseRole?: string, options?: { enabled?: boolean }) => {
        accessibleBuildingsEnabled = options?.enabled;
        return {
        data: [{ id: "building-1", name: "Tower One" }],
        isLoading: false,
        };
    },
    useAdminUsers: (_buildingIds?: string[], options?: { enabled?: boolean }) => {
        adminUsersEnabled = options?.enabled;
        return { data: usersData, isLoading: false };
    },
    useDeleteUser: () => ({ mutate: vi.fn() }),
}));

describe("PortalUsersPage", () => {
    beforeEach(() => {
        authState = {
            user: { id: "user-1", effectivePermissions: ["users.write"], buildingIds: ["building-1"] },
            baseRole: "building_admin",
            login: vi.fn(),
            token: "token-1",
        };
        accessibleBuildingsEnabled = undefined;
        adminUsersEnabled = undefined;
        usersData = [
            {
                id: "u1",
                name: "Building Admin",
                email: "a@example.com",
                role: "building_admin",
                baseRole: "building_admin",
                buildingIds: ["building-1"],
            },
            {
                id: "u2",
                name: "Manager",
                email: "m@example.com",
                role: "manager",
                baseRole: "manager",
                buildingIds: ["building-1"],
            },
        ];
    });

    it("renders a flattened directory with explicit access stats for building-scoped users", () => {
        const markup = renderToStaticMarkup(createElement(PortalUsersPage));

        expect(markup).toContain("Directory");
        expect(markup).toContain("Building only 2");
        expect(markup).toContain("Org access 0");
        expect(markup).not.toContain("Building Admins");
        expect(markup).toContain("rows:2");
        expect(accessibleBuildingsEnabled).toBe(true);
        expect(adminUsersEnabled).toBe(true);
    });

    it("shows mixed explicit-access stats for org admins without reintroducing role tabs", () => {
        authState = {
            ...authState,
            baseRole: "org_admin",
            user: {
                ...authState.user,
                orgAccess: { roleId: "role-org-admin", roleKey: "org_admin", roleName: "Org Admin" },
                orgRoleKeys: ["org_admin"],
            },
        };
        usersData = [
            ...usersData,
            {
                id: "u3",
                name: "Org Admin",
                email: "org@example.com",
                role: "org_admin",
                baseRole: "org_admin",
                buildingIds: [],
                orgAccess: { roleId: "role-org-admin", roleKey: "org_admin", roleName: "Org Admin" },
            },
        ];

        const markup = renderToStaticMarkup(createElement(PortalUsersPage));

        expect(markup).toContain("Directory");
        expect(markup).toContain("Org access 1");
        expect(markup).toContain("Building only 2");
        expect(markup).not.toContain("Org Admins");
        expect(markup).not.toContain("Building Admins");
        expect(markup).toContain("rows:3");
    });

    it("disables user queries when the user lacks users permissions", () => {
        authState = {
            user: { id: "user-1", effectivePermissions: [], buildingIds: ["building-1"] },
            baseRole: "building_admin",
            login: vi.fn(),
            token: "token-1",
        };

        const markup = renderToStaticMarkup(createElement(PortalUsersPage));

        expect(markup).toContain("You do not have permission to view users.");
        expect(accessibleBuildingsEnabled).toBe(false);
        expect(adminUsersEnabled).toBe(false);
    });
});
