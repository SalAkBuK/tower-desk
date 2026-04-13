import { describe, expect, it } from "vitest";
import type { BaseRole, User } from "../../src/lib/types";
import { resolvePortalRoute } from "../../src/lib/portalRoute";
import { getDefaultHomeRoute } from "../../src/lib/homeRoute";

const makeUser = (overrides?: Partial<User>): User => ({
    id: "u1",
    name: "Portal User",
    email: "portal@example.com",
    role: "admin",
    baseRole: "admin",
    buildingIds: [],
    effectivePermissions: [],
    roleKeys: [],
    orgRoleKeys: [],
    ...overrides,
});

describe("resolvePortalRoute", () => {
    it("routes unauthenticated users to login when role is missing", () => {
        const result = resolvePortalRoute({ user: null, baseRole: undefined });
        expect(result.destination).toBe("/login");
    });

    it("resolves first entitled module for portal home", () => {
        const result = resolvePortalRoute({
            baseRole: "manager",
            user: makeUser({
                role: "manager",
                baseRole: "manager",
                effectivePermissions: ["requests.read"],
            }),
        });

        expect(result.destination).toBe("/portal/requests");
    });

    it("prefers dashboard as portal home when dashboard.read is available", () => {
        const result = resolvePortalRoute({
            baseRole: "org_admin",
            user: makeUser({
                role: "org_admin",
                baseRole: "org_admin",
                effectivePermissions: ["dashboard.read", "requests.read"],
            }),
        });

        expect(result.destination).toBe("/portal/dashboard");
    });

    it("returns 403 when portal home has no entitled modules", () => {
        const result = resolvePortalRoute({
            baseRole: "admin",
            user: makeUser({
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
        });

        expect(result.destination).toBe("/403");
    });

    it("falls back to baseline manager portal access when permission metadata is missing", () => {
        const result = resolvePortalRoute({
            baseRole: "manager",
            user: makeUser({
                role: "manager",
                baseRole: "manager",
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
        });

        expect(result.destination).toBe("/portal/requests");
    });

    it("keeps building admins in the portal when permission metadata is missing", () => {
        const result = resolvePortalRoute({
            baseRole: "building_admin",
            user: makeUser({
                role: "building_admin",
                baseRole: "building_admin",
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
        });

        expect(result.destination).toBe("/portal/requests");
    });

    it("routes provider managers to the provider dashboard when permission metadata is missing", () => {
        const result = resolvePortalRoute({
            baseRole: "service_provider",
            user: makeUser({
                role: "service_provider",
                baseRole: "service_provider",
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
        });

        expect(result.destination).toBe("/portal/dashboard");
    });

    it("routes owner users to the owner dashboard when permission metadata is missing", () => {
        const result = resolvePortalRoute({
            baseRole: "owner",
            user: makeUser({
                role: "owner",
                baseRole: "owner",
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
        });

        expect(result.destination).toBe("/portal/dashboard");
    });

    it("blocks tenant portal routing and sends them back to login", () => {
        const result = resolvePortalRoute({
            baseRole: "tenant",
            user: makeUser({
                role: "tenant",
                baseRole: "tenant",
                effectivePermissions: ["requests.read"],
            }),
        });

        expect(result.destination).toBe("/login?reason=mobile-app-only");
    });

    it("keeps authorized detail routes canonical under /portal", () => {
        const result = resolvePortalRoute({
            baseRole: "manager",
            user: makeUser({
                role: "manager",
                baseRole: "manager",
                effectivePermissions: ["leases.read"],
            }),
            slug: ["leases", "lease-123"],
        });

        expect(result.destination).toBe("/portal/leases/lease-123");
    });

    it("blocks module path without permission", () => {
        const result = resolvePortalRoute({
            baseRole: "manager",
            user: makeUser({
                role: "manager",
                baseRole: "manager",
                effectivePermissions: ["requests.read"],
            }),
            slug: ["reports"],
        });

        expect(result.destination).toBe("/403");
    });

    it("allows access modules when explicit permissions are present even for building-scoped roles", () => {
        const result = resolvePortalRoute({
            baseRole: "building_admin",
            user: makeUser({
                role: "building_admin",
                baseRole: "building_admin",
                effectivePermissions: ["roles.write", "users.write"],
            }),
            slug: ["access"],
        });

        expect(result.destination).toBe("/portal/access");
    });

    it("supports known superadmin segments and rejects unknown ones", () => {
        const allowed = resolvePortalRoute({
            baseRole: "superadmin",
            user: makeUser({
                role: "superadmin",
                baseRole: "superadmin",
            }),
            slug: ["permissions"],
        });
        const denied = resolvePortalRoute({
            baseRole: "superadmin",
            user: makeUser({
                role: "superadmin",
                baseRole: "superadmin",
            }),
            slug: ["units"],
        });

        expect(allowed.destination).toBe("/platform/permissions");
        expect(denied.destination).toBe("/403");
    });

    it("keeps owners route canonical in the portal", () => {
        const result = resolvePortalRoute({
            baseRole: "admin",
            user: makeUser({
                effectivePermissions: ["owners.read"],
            }),
            slug: ["owners"],
        });

        expect(result.destination).toBe("/portal/owners");
    });

    it("allows org admins to open owners even when explicit owner permissions are missing", () => {
        const result = resolvePortalRoute({
            baseRole: "org_admin",
            user: makeUser({
                role: "org_admin",
                baseRole: "org_admin",
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
            slug: ["owners"],
        });

        expect(result.destination).toBe("/portal/owners");
    });

    it("keeps providers route canonical in the portal when permission is present", () => {
        const result = resolvePortalRoute({
            baseRole: "admin",
            user: makeUser({
                effectivePermissions: ["serviceProviders.read"],
            }),
            slug: ["providers"],
        });

        expect(result.destination).toBe("/portal/providers");
    });

    it("blocks providers route without provider permission", () => {
        const result = resolvePortalRoute({
            baseRole: "manager",
            user: makeUser({
                role: "manager",
                baseRole: "manager",
                effectivePermissions: ["requests.read"],
            }),
            slug: ["providers"],
        });

        expect(result.destination).toBe("/403");
    });

    it("keeps provider request inbox canonical for service provider users", () => {
        const result = resolvePortalRoute({
            baseRole: "service_provider",
            user: makeUser({
                role: "service_provider",
                baseRole: "service_provider",
                effectivePermissions: ["requests.write"],
            }),
            slug: ["requests"],
        });

        expect(result.destination).toBe("/portal/requests");
    });

    it("keeps provider profile canonical for service provider users", () => {
        const result = resolvePortalRoute({
            baseRole: "service_provider",
            user: makeUser({
                role: "service_provider",
                baseRole: "service_provider",
                effectivePermissions: ["requests.write"],
            }),
            slug: ["profile"],
        });

        expect(result.destination).toBe("/portal/profile");
    });

    it("keeps provider staff canonical for service provider users", () => {
        const result = resolvePortalRoute({
            baseRole: "service_provider",
            user: makeUser({
                role: "service_provider",
                baseRole: "service_provider",
                effectivePermissions: ["requests.write"],
            }),
            slug: ["staff"],
        });

        expect(result.destination).toBe("/portal/staff");
    });

    it("keeps owner notifications canonical for owner users", () => {
        const result = resolvePortalRoute({
            baseRole: "owner",
            user: makeUser({
                role: "owner",
                baseRole: "owner",
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
            slug: ["notifications"],
        });

        expect(result.destination).toBe("/portal/notifications");
    });
});

describe("getDefaultHomeRoute", () => {
    it("sends admin-like roles to /portal", () => {
        const route = getDefaultHomeRoute(
            makeUser({
                role: "org_admin",
                baseRole: "org_admin",
                effectivePermissions: ["requests.read"],
            }),
            "org_admin" as BaseRole
        );

        expect(route).toBe("/portal");
    });

    it("keeps dashboard-enabled org admins on the portal shell home", () => {
        const route = getDefaultHomeRoute(
            makeUser({
                role: "org_admin",
                baseRole: "org_admin",
                effectivePermissions: ["dashboard.read", "requests.read"],
            }),
            "org_admin" as BaseRole
        );

        expect(route).toBe("/portal");
    });

    it("routes building admins into the portal when they have scoped permissions", () => {
        const route = getDefaultHomeRoute(
            makeUser({
                role: "building_admin",
                baseRole: "building_admin",
                effectivePermissions: ["requests.read"],
            }),
            "building_admin" as BaseRole
        );

        expect(route).toBe("/portal");
    });

    it("routes managers into the portal when permission metadata is missing", () => {
        const route = getDefaultHomeRoute(
            makeUser({
                role: "manager",
                baseRole: "manager",
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
            "manager"
        );

        expect(route).toBe("/portal");
    });

    it("routes provider managers into the portal shell", () => {
        const route = getDefaultHomeRoute(
            makeUser({
                role: "service_provider",
                baseRole: "service_provider",
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
            "service_provider"
        );

        expect(route).toBe("/portal");
    });

    it("keeps superadmin home on /platform/orgs", () => {
        const route = getDefaultHomeRoute(
            makeUser({
                role: "superadmin",
                baseRole: "superadmin",
            }),
            "superadmin"
        );

        expect(route).toBe("/platform/orgs");
    });

    it("returns /403 if no entitled module exists", () => {
        const route = getDefaultHomeRoute(
            makeUser({
                effectivePermissions: [],
                roleKeys: [],
                orgRoleKeys: [],
            }),
            "admin"
        );

        expect(route).toBe("/403");
    });

    it("routes tenant users back to login instead of the portal", () => {
        const route = getDefaultHomeRoute(
            makeUser({
                role: "tenant",
                baseRole: "tenant",
                effectivePermissions: ["requests.read"],
            }),
            "tenant"
        );

        expect(route).toBe("/login?reason=mobile-app-only");
    });
});
