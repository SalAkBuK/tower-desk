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
});
