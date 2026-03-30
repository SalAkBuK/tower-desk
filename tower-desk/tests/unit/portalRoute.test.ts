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

    it("keeps org-wide admin modules blocked for building_admin", () => {
        const result = resolvePortalRoute({
            baseRole: "building_admin",
            user: makeUser({
                role: "building_admin",
                baseRole: "building_admin",
                effectivePermissions: ["roles.write", "users.write"],
            }),
            slug: ["access"],
        });

        expect(result.destination).toBe("/403");
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

        expect(allowed.destination).toBe("/sa/permissions");
        expect(denied.destination).toBe("/403");
    });

    it("redirects owners alias to residents", () => {
        const result = resolvePortalRoute({
            baseRole: "admin",
            user: makeUser({
                effectivePermissions: ["residents.read"],
            }),
            slug: ["owners"],
        });

        expect(result.destination).toBe("/portal/residents");
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

    it("keeps superadmin home on /sa/orgs", () => {
        const route = getDefaultHomeRoute(
            makeUser({
                role: "superadmin",
                baseRole: "superadmin",
            }),
            "superadmin"
        );

        expect(route).toBe("/sa/orgs");
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
