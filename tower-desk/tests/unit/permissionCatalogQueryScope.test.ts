import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
    useQuery: vi.fn((options) => options),
    useMutation: vi.fn((options) => options),
    useQueryClient: vi.fn(() => ({
        invalidateQueries: vi.fn(),
    })),
}));

process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:3001/api";

const userQueries = await import("../../src/lib/queries/users");
const { useAuthStore } = await import("../../src/lib/auth");

describe("permission catalog query scope", () => {
    beforeEach(() => {
        useAuthStore.setState({
            user: {
                id: "user-1",
                name: "Org Admin",
                email: "org@example.com",
                role: "org_admin",
                baseRole: "org_admin",
                orgId: "org-1",
                buildingIds: [],
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            },
            selectedOrgId: null,
        } as any);
    });

    it("scopes permission queries by user role and org context", () => {
        const permissionsQuery = userQueries.usePermissions({ enabled: true }) as any;
        const roleTemplatesQuery = userQueries.useRoleTemplates({ enabled: true }) as any;

        expect(permissionsQuery.queryKey).toEqual(["permissions", "user-1", "org_admin", "org-1"]);
        expect(roleTemplatesQuery.queryKey).toEqual(["role-templates", "user-1", "org_admin", "org-1"]);
    });

    it("updates query keys when selected org changes", () => {
        useAuthStore.setState({ selectedOrgId: "org-2" } as any);

        const permissionsQuery = userQueries.usePermissions({ enabled: true }) as any;
        const rolesQuery = userQueries.useRoles({ enabled: true }) as any;

        expect(permissionsQuery.queryKey).toEqual(["permissions", "user-1", "org_admin", "org-2"]);
        expect(rolesQuery.queryKey).toEqual(["roles", "user-1", "org_admin", "org-2"]);
    });
});
