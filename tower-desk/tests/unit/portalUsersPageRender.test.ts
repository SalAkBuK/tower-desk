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

vi.mock("@/components/users/UsersTable", () => ({
    UsersTable: ({ users }: { users?: unknown[] }) => createElement("div", {}, `rows:${users?.length ?? 0}`),
}));

vi.mock("@/components/users/CreateUserSheet", () => ({
    CreateUserSheet: () => null,
}));

vi.mock("@/lib/queries", () => ({
    useAccessibleBuildings: () => ({
        data: [{ id: "building-1", name: "Tower One" }],
        isLoading: false,
    }),
    useAdminUsers: () => ({ data: usersData, isLoading: false }),
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
        usersData = [
            { id: "u1", name: "Building Admin", email: "a@example.com", role: "building_admin", baseRole: "building_admin", buildingIds: ["building-1"] },
            { id: "u2", name: "Manager", email: "m@example.com", role: "manager", baseRole: "manager", buildingIds: ["building-1"] },
        ];
    });

    it("keeps building-scoped roles off org-admin tabs", () => {
        const markup = renderToStaticMarkup(createElement(PortalUsersPage));

        expect(markup).toContain("Building Admins");
        expect((markup.match(/role="tab"/g) || []).length).toBe(4);
    });

    it("shows org-admin tabs for org admins", () => {
        authState = {
            ...authState,
            baseRole: "org_admin",
            user: { ...authState.user, orgRoleKeys: ["org_admin"] },
        };
        usersData = [
            ...usersData,
            { id: "u3", name: "Org Admin", email: "org@example.com", role: "org_admin", baseRole: "org_admin", buildingIds: [] },
        ];

        const markup = renderToStaticMarkup(createElement(PortalUsersPage));

        expect(markup).toContain("Org Admins");
        expect(markup).toContain("Building Admins");
        expect(markup).not.toContain(">Admins<");
    });
});
