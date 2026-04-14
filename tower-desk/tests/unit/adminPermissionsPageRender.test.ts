import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPermissionsPage from "../../src/app/(dashboard)/admin/permissions/page";

let authState: any;
let roleTemplates: any[] = [];
let permissionCatalog: any[] = [];

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/lib/rbac", () => ({
    hasPermission: (user: any, key: string) => Boolean(user?.effectivePermissions?.includes(key)),
}));

vi.mock("@/lib/queries", () => ({
    useRoleTemplates: () => ({
        data: roleTemplates,
        isLoading: false,
    }),
    usePermissions: () => ({
        data: permissionCatalog,
    }),
    useCreateRole: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() }),
    useDeleteRole: () => ({ isPending: false, mutate: vi.fn() }),
    useSetRolePermissions: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() }),
    useUpdateRoleTemplate: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/components/ui/button", () => ({
    Button: ({ children, ...props }: any) => createElement("button", props, children),
}));

vi.mock("@/components/ui/input", () => ({
    Input: (props: any) => createElement("input", props),
}));

vi.mock("@/components/ui/badge", () => ({
    Badge: ({ children, ...props }: any) => createElement("span", props, children),
}));

vi.mock("@/components/ui/select", () => ({
    Select: ({ children }: any) => createElement("div", { "data-slot": "select" }, children),
    SelectTrigger: ({ children }: any) => createElement("button", { "data-slot": "select-trigger" }, children),
    SelectValue: ({ placeholder }: any) => createElement("span", null, placeholder ?? ""),
    SelectContent: ({ children }: any) => createElement("div", { "data-slot": "select-content" }, children),
    SelectItem: ({ children, value }: any) => createElement("div", { "data-slot": "select-item", "data-value": value }, children),
}));

describe("AdminPermissionsPage", () => {
    beforeEach(() => {
        authState = {
            baseRole: "org_admin",
            user: {
                id: "org-user-1",
                effectivePermissions: ["roles.write"],
            },
        };
        roleTemplates = [
            {
                id: "role-1",
                key: "org_admin",
                name: "Org Admin",
                permissionKeys: ["roles.read", "requests.read"],
                scopeType: "ORG",
            },
        ];
        permissionCatalog = [
            { key: "roles.read", name: "Roles: Read" },
            { key: "roles.write", name: "Roles: Write" },
            { key: "requests.read", name: "Requests: Read" },
            { key: "serviceProviders.read", name: "Service Providers: Read" },
            { key: "service_providers.read", name: "Service Providers Read Legacy" },
        ];
    });

    it("renders only permission keys returned by the org API response", () => {
        const markup = renderToStaticMarkup(createElement(AdminPermissionsPage));

        expect(markup).toContain("roles.read");
        expect(markup).toContain("roles.write");
        expect(markup).toContain("requests.read");
        expect(markup).toContain("serviceProviders.read");
        expect(markup).toContain("service_providers.read");
        expect(markup).not.toContain("platform.org.read");
        expect(markup).not.toContain("platform.org.admin.read");
        expect(markup).not.toContain("platform.delivery_tasks.read");
        expect(markup).toContain("Live API permission catalog");
    });
});
