import { describe, expect, it } from "vitest";
import { getPortalRenderDescriptor, matchPortalRoute } from "../../src/lib/portalRegistry";

describe("portal registry route matching", () => {
    it("matches the dashboard route", () => {
        const match = matchPortalRoute(["dashboard"]);

        expect(match?.route.id).toBe("dashboard-index");
        expect(match?.params).toEqual({});
    });

    it("prefers static routes before dynamic ones", () => {
        const match = matchPortalRoute(["contracts", "move-in"]);

        expect(match?.route.id).toBe("contracts-move-in");
    });

    it("extracts dynamic params for detail routes", () => {
        const match = matchPortalRoute(["buildings", "building-1"]);

        expect(match?.route.id).toBe("buildings-detail");
        expect(match?.params).toEqual({ buildingId: "building-1" });
    });

    it("matches the providers route", () => {
        const match = matchPortalRoute(["providers"]);

        expect(match?.route.id).toBe("providers-index");
        expect(match?.params).toEqual({});
    });

    it("matches provider profile and staff routes", () => {
        const profileMatch = matchPortalRoute(["profile"]);
        const staffMatch = matchPortalRoute(["staff"]);

        expect(profileMatch?.route.id).toBe("provider-profile-index");
        expect(profileMatch?.params).toEqual({});
        expect(staffMatch?.route.id).toBe("provider-staff-index");
        expect(staffMatch?.params).toEqual({});
    });

    it("matches the owner notifications route", () => {
        const match = matchPortalRoute(["notifications"]);

        expect(match?.route.id).toBe("notifications-index");
        expect(match?.params).toEqual({});
    });
});

describe("portal render descriptors", () => {
    it("selects dashboard for admin routes", () => {
        const descriptor = getPortalRenderDescriptor("org_admin", ["dashboard"]);

        expect(descriptor).toEqual({
            routeId: "dashboard-index",
            variant: "admin",
            params: {},
        });
    });

    it("selects the manager variant for manager routes", () => {
        const descriptor = getPortalRenderDescriptor("manager", ["requests"]);

        expect(descriptor).toEqual({
            routeId: "requests-index",
            variant: "manager",
            params: {},
        });
    });

    it("selects the admin variant for admin-like roles", () => {
        const descriptor = getPortalRenderDescriptor("admin", ["contracts", "contract-1"]);

        expect(descriptor).toEqual({
            routeId: "contracts-detail",
            variant: "admin",
            params: { contractId: "contract-1" },
        });
    });

    it("selects the manager variant for providers routes", () => {
        const descriptor = getPortalRenderDescriptor("manager", ["providers"]);

        expect(descriptor).toEqual({
            routeId: "providers-index",
            variant: "manager",
            params: {},
        });
    });

    it("selects the provider variant for service provider routes", () => {
        const descriptor = getPortalRenderDescriptor("service_provider", ["requests"]);

        expect(descriptor).toEqual({
            routeId: "requests-index",
            variant: "provider",
            params: {},
        });
    });

    it("selects the provider variant for provider profile routes", () => {
        const descriptor = getPortalRenderDescriptor("service_provider", ["profile"]);

        expect(descriptor).toEqual({
            routeId: "provider-profile-index",
            variant: "provider",
            params: {},
        });
    });

    it("selects the owner variant for owner notification routes", () => {
        const descriptor = getPortalRenderDescriptor("owner", ["notifications"]);

        expect(descriptor).toEqual({
            routeId: "notifications-index",
            variant: "owner",
            params: {},
        });
    });
});
