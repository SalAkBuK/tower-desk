import { describe, expect, it } from "vitest";

import {
    canAccessPortalRole,
    formatRoleLabel,
    getCanonicalRole,
    isBuildingAdminRole,
    isBuildingScopedPortalRole,
    isBuildingScopedManagementRole,
    isOrganizationAdminRole,
    isPrimaryOrgAccessRoleDefinition,
    toCanonicalRole,
} from "../../src/lib/roles";

describe("role helpers", () => {
    it("normalizes building admin variants to the building_admin canonical role", () => {
        expect(toCanonicalRole("building_admin")).toBe("building_admin");
        expect(toCanonicalRole("building-admin")).toBe("building_admin");
        expect(toCanonicalRole("Building Administrator")).toBe("building_admin");
        expect(toCanonicalRole("building_staff")).toBe("employee");
    });

    it("keeps building_admin distinct from org-wide admin roles", () => {
        const user = {
            role: "building_admin",
            buildingIds: [],
            email: "admin@example.com",
            id: "u1",
            name: "Building Admin",
        };

        expect(getCanonicalRole(user)).toBe("building_admin");
        expect(isBuildingAdminRole(user)).toBe(true);
        expect(isOrganizationAdminRole(user)).toBe(false);
        expect(isBuildingScopedPortalRole(user)).toBe(true);
        expect(isBuildingScopedManagementRole(user)).toBe(true);
    });

    it("formats building_admin labels for the UI", () => {
        expect(formatRoleLabel("building_admin")).toBe("Building Admin");
    });

    it("denies tenant portal access", () => {
        expect(canAccessPortalRole("tenant")).toBe(false);
        expect(canAccessPortalRole("resident")).toBe(false);
        expect(canAccessPortalRole("admin")).toBe(true);
    });

    it("treats org roles as eligible primary org access and excludes resident roles", () => {
        expect(isPrimaryOrgAccessRoleDefinition({ key: "org_admin", name: "Org Admin" })).toBe(true);
        expect(isPrimaryOrgAccessRoleDefinition({ key: "viewer", name: "Viewer" })).toBe(true);
        expect(isPrimaryOrgAccessRoleDefinition({ key: "custom_ops", name: "Custom Ops" })).toBe(true);
        expect(isPrimaryOrgAccessRoleDefinition({ key: "manager", name: "Manager" })).toBe(false);
        expect(isPrimaryOrgAccessRoleDefinition({ key: "admin", name: "Admin" })).toBe(false);
        expect(isPrimaryOrgAccessRoleDefinition({ key: "resident", name: "Resident" })).toBe(false);
    });
});
