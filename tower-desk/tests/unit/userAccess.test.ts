import { describe, expect, it } from "vitest";

import {
    getBuildingAccessAssignments,
    getOrgAccessAssignments,
    getUserAccessView,
    hasBuildingAssignment,
    hasBuildingRole,
    hasOrgScopedAccess,
    hasPermission,
    isBuildingScopedOnlyAccess,
    normalizeUserFromApi,
} from "../../src/lib/userAccess";

describe("user access normalization", () => {
    it("normalizes RBAC v2 orgAccess and buildingAccess arrays", () => {
        const user = normalizeUserFromApi({
            id: "user-1",
            email: "ops@example.com",
            orgId: "org-1",
            orgAccess: [
                {
                    assignmentId: "org-assignment-1",
                    roleTemplateKey: "org_admin",
                    scopeType: "ORG",
                    scopeId: null,
                },
            ],
            buildingAccess: [
                {
                    assignmentId: "building-assignment-1",
                    roleTemplateKey: "building_manager",
                    scopeType: "BUILDING",
                    scopeId: "building-a",
                    buildingName: "Tower A",
                },
            ],
            effectivePermissions: ["messaging.read", "broadcasts.write"],
        });

        expect(user).not.toBeNull();
        expect(user?.orgAccess).toHaveLength(1);
        expect(user?.buildingAccess).toHaveLength(1);
        expect(user?.primaryOrgAccess?.roleKey).toBe("org_admin");
        expect(user?.buildingAssignments?.[0]?.buildingId).toBe("building-a");
        expect(user?.buildingIds).toEqual(["building-a"]);
    });

    it("converts legacy buildingAssignments into buildingAccess helpers", () => {
        const user = normalizeUserFromApi({
            id: "user-2",
            email: "manager@example.com",
            orgId: "org-1",
            buildingAssignments: [
                {
                    id: "legacy-building-assignment",
                    buildingId: "building-b",
                    type: "MANAGER",
                },
            ],
            effectivePermissions: ["messaging.write"],
        });

        expect(user).not.toBeNull();
        expect(getOrgAccessAssignments(user)).toHaveLength(0);
        expect(getBuildingAccessAssignments(user)).toHaveLength(1);
        expect(hasOrgScopedAccess(user)).toBe(false);
        expect(isBuildingScopedOnlyAccess(user)).toBe(true);
        expect(hasPermission(user, "messaging.write")).toBe(true);
        expect(hasBuildingAssignment(user, "building-b")).toBe(true);
        expect(hasBuildingRole(user, "building-b", "building_manager")).toBe(true);
    });

    it("builds access-view compatibility fields from access arrays", () => {
        const user = normalizeUserFromApi({
            id: "user-3",
            email: "viewer@example.com",
            orgId: "org-1",
            orgAccess: {
                roleId: "viewer-role-id",
                roleKey: "viewer",
                roleName: "Viewer",
            },
            buildingAccess: [
                {
                    assignmentId: "building-assignment-3",
                    roleTemplateKey: "building_admin",
                    scopeType: "BUILDING",
                    scopeId: "building-c",
                },
            ],
            resident: null,
            effectivePermissions: ["broadcasts.read"],
        });

        const access = getUserAccessView(user);

        expect(access.primaryOrgAccess?.roleId).toBe("viewer-role-id");
        expect(access.primaryOrgAccess?.roleKey).toBe("viewer");
        expect(access.buildingAssignments).toHaveLength(1);
        expect(access.buildingAssignments[0]?.type).toBe("BUILDING_ADMIN");
        expect(access.effectivePermissions).toEqual(["broadcasts.read"]);
    });

    it("does not infer superadmin only from a null orgId", () => {
        const user = normalizeUserFromApi({
            id: "user-4",
            email: "provider@example.com",
            orgId: null,
            orgAccess: [],
            buildingAccess: [],
            effectivePermissions: [],
        });

        expect(user).not.toBeNull();
        expect(user?.baseRole).toBeUndefined();
    });

    it("recognizes platform persona users without an org assignment", () => {
        const user = normalizeUserFromApi({
            id: "user-5",
            email: "superadmin@towerdesk.com",
            orgId: null,
            persona: {
                isPlatformAdmin: true,
            },
            orgAccess: [],
            buildingAccess: [],
            effectivePermissions: [],
        });

        expect(user).not.toBeNull();
        expect(user?.baseRole).toBe("superadmin");
    });

    it("strips opaque ids from display labels and badges", () => {
        const user = normalizeUserFromApi({
            id: "user-6",
            email: "manager@example.com",
            orgId: "org-1",
            baseRole: "manager",
            display: {
                primaryLabel: "Manager - 4ff006e8-b1a8-4cbd-9571-a248acb4af0b",
                badges: [
                    { label: "Building assignment - 4ff006e8-b1a8-4cbd" },
                ],
            },
            buildingAssignments: [
                {
                    buildingId: "4ff006e8-b1a8-4cbd",
                    type: "BUILDING_ADMIN",
                },
            ],
        });

        const access = getUserAccessView(user);

        expect(access.displayLabel).toBe("Manager");
        expect(access.displayBadges.map((badge) => badge.label)).toEqual(["Building Admin"]);
    });
});
