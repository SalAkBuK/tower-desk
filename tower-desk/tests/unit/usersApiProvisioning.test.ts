import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

async function loadUsersApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    const usersApi = await import("../../src/lib/api/users");
    const auth = await import("../../src/lib/auth");
    return { usersApi, useAuthStore: auth.useAuthStore };
}

describe("users api provisioning", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("provisions role templates in one request and preserves backend building_admin role", async () => {
        const { usersApi, useAuthStore } = await loadUsersApi();

        useAuthStore.setState({
            token: null,
            refreshToken: null,
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null,
        });

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(String(input)).toBe(`${API_BASE_URL}/org/users/provision`);
            const body = JSON.parse(String(init?.body ?? "{}"));

            expect(body).toMatchObject({
                identity: {
                    email: "building.admin@example.com",
                    name: "Building Admin",
                    sendInvite: true,
                },
                grants: {
                    roleIds: ["role-uuid-1"],
                    buildingAssignments: [
                        { buildingId: "building-uuid", type: "BUILDING_ADMIN" },
                    ],
                },
            });
            expect(body.grants.orgRoleKeys).toBeUndefined();
            expect(body.grants.roleKeys).toBeUndefined();

            return new Response(JSON.stringify({
                user: {
                    id: "user-uuid",
                    email: "building.admin@example.com",
                    name: "Building Admin",
                    orgId: "org-uuid",
                    role: "building_admin",
                    baseRole: "building_admin",
                    roleIds: ["role-uuid-1"],
                    roleKeys: ["custom_role_key"],
                    effectivePermissions: ["contracts.read", "contracts.write"],
                    buildingIds: ["building-uuid"],
                    buildingAssignments: [
                        { id: "assignment-uuid", buildingId: "building-uuid", type: "BUILDING_ADMIN" },
                    ],
                    resident: null,
                    assignedRoles: [
                        {
                            id: "role-uuid-1",
                            key: "custom_role_key",
                            name: "Custom Role",
                            description: null,
                        },
                    ],
                },
                created: true,
                linkedExisting: false,
                applied: {
                    roleIds: ["role-uuid-1"],
                    roleKeys: ["custom_role_key"],
                    orgRoleKeys: ["custom_role_key"],
                    roles: [
                        {
                            id: "role-uuid-1",
                            key: "custom_role_key",
                            name: "Custom Role",
                            description: null,
                        },
                    ],
                    buildingAssignments: [
                        { id: "assignment-uuid", buildingId: "building-uuid", type: "BUILDING_ADMIN" },
                    ],
                    resident: null,
                },
            }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        });

        vi.stubGlobal("fetch", fetchMock);

        const user = await usersApi.createUser("admin", {
            fullName: "Building Admin",
            email: "building.admin@example.com",
            buildingIds: ["building-uuid"],
            roleIds: ["role-uuid-1"],
            assignmentType: "admin",
        });

        expect(user.id).toBe("user-uuid");
        expect(user.role).toBe("building_admin");
        expect(user.baseRole).toBe("building_admin");
        expect(user.roleKeys).toEqual(["custom_role_key"]);
        expect(user.orgRoleKeys).toEqual(["custom_role_key"]);
        expect(user.effectivePermissions).toEqual(["contracts.read", "contracts.write"]);
        expect(user.buildingIds).toEqual(["building-uuid"]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
