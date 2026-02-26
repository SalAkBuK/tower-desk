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

    it("maps portal module path to manager legacy route", () => {
        const result = resolvePortalRoute({
            baseRole: "manager",
            user: makeUser({
                role: "manager",
                baseRole: "manager",
                effectivePermissions: ["leases.read"],
            }),
            slug: ["leases", "lease-123"],
        });

        expect(result.destination).toBe("/manager/leases/lease-123");
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
});
