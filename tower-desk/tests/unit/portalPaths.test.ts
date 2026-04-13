import { describe, expect, it } from "vitest";
import { normalizeToPortalPath, portalPath } from "../../src/lib/portalPaths";

describe("normalizeToPortalPath", () => {
    it("maps admin and manager paths to portal aliases", () => {
        expect(normalizeToPortalPath("/admin/requests")).toBe("/portal/requests");
        expect(normalizeToPortalPath("/manager/buildings/b1")).toBe("/portal/buildings/b1");
        expect(normalizeToPortalPath("/admin/owners")).toBe("/portal/owners");
        expect(normalizeToPortalPath("/manager/providers")).toBe("/portal/providers");
    });

    it("keeps non-legacy paths unchanged", () => {
        expect(normalizeToPortalPath("/portal/leases/l1")).toBe("/portal/leases/l1");
        expect(normalizeToPortalPath("/sa/orgs")).toBe("/sa/orgs");
        expect(normalizeToPortalPath("/platform/orgs")).toBe("/platform/orgs");
    });
});

describe("portalPath", () => {
    it("builds a normalized portal module path", () => {
        expect(portalPath("leases", "lease-1")).toBe("/portal/leases/lease-1");
        expect(portalPath("/buildings/", "/b1/")).toBe("/portal/buildings/b1");
    });
});
