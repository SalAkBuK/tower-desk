import { describe, expect, it } from "vitest";
import {
    buildLeasesHref,
    getLeaseActionIds,
    resolveLeasesLandingTabFromResidentFilter,
    resolveResidentLeaseModuleHref,
    resolveUnitLeaseManagementHref,
} from "../../src/lib/leaseNavigation";

describe("buildLeasesHref", () => {
    it("returns base path when no params are provided", () => {
        expect(buildLeasesHref({})).toBe("/portal/leases");
    });

    it("keeps leases tab implicit and includes building/query params", () => {
        expect(
            buildLeasesHref({
                buildingId: "b1",
                tab: "leases",
                q: "  unit 101 ",
            })
        ).toBe("/portal/leases?buildingId=b1&q=unit+101");
    });

    it("includes operations tab when requested", () => {
        expect(
            buildLeasesHref({
                buildingId: "b2",
                tab: "operations",
            })
        ).toBe("/portal/leases?buildingId=b2&tab=operations");
    });

    it("includes lease status filter when provided", () => {
        expect(
            buildLeasesHref({
                buildingId: "b3",
                status: "ENDED",
                q: "former",
            })
        ).toBe("/portal/leases?buildingId=b3&status=ENDED&q=former");
    });
});

describe("resolveLeasesLandingTabFromResidentFilter", () => {
    it("routes NEW filter to operations tab", () => {
        expect(resolveLeasesLandingTabFromResidentFilter("NEW")).toBe("operations");
    });

    it("routes FORMER and other filters to leases tab", () => {
        expect(resolveLeasesLandingTabFromResidentFilter("FORMER")).toBe("leases");
        expect(resolveLeasesLandingTabFromResidentFilter("WITH_OCCUPANCY")).toBe("leases");
        expect(resolveLeasesLandingTabFromResidentFilter("ALL")).toBe("leases");
    });
});

describe("resolveResidentLeaseModuleHref", () => {
    it("opens operations tab search for NEW residents without lease id", () => {
        expect(
            resolveResidentLeaseModuleHref({
                effectiveBuildingId: "b1",
                residentQuery: "tenant@example.com",
                residentStatus: "NEW",
            })
        ).toBe("/portal/leases?buildingId=b1&tab=operations&q=tenant%40example.com");
    });

    it("opens active leases list for ACTIVE residents", () => {
        expect(
            resolveResidentLeaseModuleHref({
                effectiveBuildingId: "b1",
                residentQuery: "active@example.com",
                residentStatus: "ACTIVE",
            })
        ).toBe("/portal/leases?buildingId=b1&status=ACTIVE&q=active%40example.com");
    });

    it("opens ended leases list for FORMER residents", () => {
        expect(
            resolveResidentLeaseModuleHref({
                effectiveBuildingId: "b1",
                residentQuery: "former@example.com",
                residentStatus: "FORMER",
            })
        ).toBe("/portal/leases?buildingId=b1&status=ENDED&q=former%40example.com");
    });
});

describe("resolveUnitLeaseManagementHref", () => {
    it("builds unit links to leases tab with scoped search", () => {
        expect(
            resolveUnitLeaseManagementHref({
                buildingId: "b1",
                query: "A-1102",
            })
        ).toBe("/portal/leases?buildingId=b1&q=A-1102");
    });
});

describe("getLeaseActionIds", () => {
    it("shows all actions for active leases", () => {
        expect(getLeaseActionIds("ACTIVE")).toEqual(["view", "move_out", "transfer"]);
    });

    it("shows only view for non-active leases", () => {
        expect(getLeaseActionIds("ENDED")).toEqual(["view"]);
        expect(getLeaseActionIds()).toEqual(["view"]);
    });
});
