import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PortalRedirect } from "../../src/components/portal/PortalRedirect";

let authState: any;
let pathname = "/portal/profile";
const replace = vi.fn();

vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
    useRouter: () => ({ replace }),
    useSearchParams: () => ({ toString: () => "" }),
}));

vi.mock("@/lib/auth", () => ({
    useAuth: () => authState,
}));

vi.mock("@/components/buildings/BuildingDetails", () => ({
    BuildingDetails: ({ buildingId }: { buildingId: string }) => createElement("div", null, `building:${buildingId}`),
}));

vi.mock("@/lib/portalTelemetry", () => ({
    logPortalEvent: vi.fn(),
}));

vi.mock("@/app/(dashboard)/admin/dashboard/page", () => ({ default: () => createElement("div", null, "admin-dashboard") }));
vi.mock("@/app/(dashboard)/manager/dashboard/page", () => ({ default: () => createElement("div", null, "manager-dashboard") }));
vi.mock("@/app/(dashboard)/admin/requests/page", () => ({ default: () => createElement("div", null, "admin-requests") }));
vi.mock("@/app/(dashboard)/admin/residents/page", () => ({ default: () => createElement("div", null, "admin-residents") }));
vi.mock("@/app/(dashboard)/manager/residents/page", () => ({ default: () => createElement("div", null, "manager-residents") }));
vi.mock("@/app/(dashboard)/admin/contracts/page", () => ({ default: () => createElement("div", null, "admin-contracts") }));
vi.mock("@/app/(dashboard)/admin/contracts/move-in/page", () => ({ default: () => createElement("div", null, "admin-contracts-move-in") }));
vi.mock("@/app/(dashboard)/admin/contracts/[contractId]/page", () => ({ default: () => createElement("div", null, "admin-contract-detail") }));
vi.mock("@/app/(dashboard)/manager/contracts/[contractId]/page", () => ({ default: () => createElement("div", null, "manager-contract-detail") }));
vi.mock("@/app/(dashboard)/admin/leases/page", () => ({ default: () => createElement("div", null, "admin-leases") }));
vi.mock("@/app/(dashboard)/manager/leases/page", () => ({ default: () => createElement("div", null, "manager-leases") }));
vi.mock("@/app/(dashboard)/admin/leases/move-in/page", () => ({ default: () => createElement("div", null, "admin-leases-move-in") }));
vi.mock("@/app/(dashboard)/manager/leases/move-in/page", () => ({ default: () => createElement("div", null, "manager-leases-move-in") }));
vi.mock("@/app/(dashboard)/admin/leases/[leaseId]/page", () => ({ default: () => createElement("div", null, "admin-lease-detail") }));
vi.mock("@/app/(dashboard)/manager/leases/[leaseId]/page", () => ({ default: () => createElement("div", null, "manager-lease-detail") }));
vi.mock("@/app/(dashboard)/admin/occupancy/page", () => ({ default: () => createElement("div", null, "admin-occupancy") }));
vi.mock("@/app/(dashboard)/admin/visitors/page", () => ({ default: () => createElement("div", null, "admin-visitors") }));
vi.mock("@/app/(dashboard)/manager/visitors/page", () => ({ default: () => createElement("div", null, "manager-visitors") }));
vi.mock("@/app/(dashboard)/admin/messages/page", () => ({ default: () => createElement("div", null, "admin-messages") }));
vi.mock("@/app/(dashboard)/admin/broadcasts/page", () => ({ default: () => createElement("div", null, "admin-broadcasts") }));
vi.mock("@/app/(dashboard)/admin/buildings/page", () => ({ default: () => createElement("div", null, "admin-buildings") }));
vi.mock("@/app/(dashboard)/admin/units/page", () => ({ default: () => createElement("div", null, "admin-units") }));
vi.mock("@/app/(dashboard)/manager/units/page", () => ({ default: () => createElement("div", null, "manager-units") }));
vi.mock("@/app/(dashboard)/admin/parking/page", () => ({ default: () => createElement("div", null, "admin-parking") }));
vi.mock("@/app/(dashboard)/admin/owners/page", () => ({ default: () => createElement("div", null, "admin-owners") }));
vi.mock("@/app/(dashboard)/admin/providers/page", () => ({ default: () => createElement("div", null, "admin-providers") }));
vi.mock("@/app/(dashboard)/admin/users/page", () => ({ default: () => createElement("div", null, "admin-users") }));
vi.mock("@/app/(dashboard)/admin/permissions/page", () => ({ default: () => createElement("div", null, "admin-permissions") }));
vi.mock("@/app/(dashboard)/manager/permissions/page", () => ({ default: () => createElement("div", null, "manager-permissions") }));
vi.mock("@/app/(dashboard)/admin/access/page", () => ({ default: () => createElement("div", null, "admin-access") }));
vi.mock("@/app/(dashboard)/manager/access/page", () => ({ default: () => createElement("div", null, "manager-access") }));
vi.mock("@/app/(dashboard)/admin/reports/page", () => ({ default: () => createElement("div", null, "admin-reports") }));
vi.mock("@/app/(dashboard)/manager/owners/page", () => ({ default: () => createElement("div", null, "manager-owners") }));
vi.mock("@/app/(dashboard)/manager/providers/page", () => ({ default: () => createElement("div", null, "manager-providers") }));
vi.mock("@/app/(dashboard)/owner/dashboard/page", () => ({ default: () => createElement("div", null, "owner-dashboard-route") }));
vi.mock("@/app/(dashboard)/owner/messages/page", () => ({ default: () => createElement("div", null, "owner-messages-route") }));
vi.mock("@/app/(dashboard)/owner/notifications/page", () => ({ default: () => createElement("div", null, "owner-notifications-route") }));
vi.mock("@/app/(dashboard)/owner/requests/page", () => ({ default: () => createElement("div", null, "owner-requests-route") }));
vi.mock("@/app/(dashboard)/provider/dashboard/page", () => ({ default: () => createElement("div", null, "provider-dashboard-route") }));
vi.mock("@/app/(dashboard)/provider/requests/page", () => ({ default: () => createElement("div", null, "provider-requests-route") }));
vi.mock("@/app/(dashboard)/provider/profile/page", () => ({ default: () => createElement("div", null, "provider-profile-route") }));
vi.mock("@/app/(dashboard)/provider/staff/page", () => ({ default: () => createElement("div", null, "provider-staff-route") }));

describe("PortalRedirect render", () => {
    beforeEach(() => {
        replace.mockReset();
        authState = {
            user: {
                id: "provider-user-1",
                role: "service_provider",
                baseRole: "service_provider",
                effectivePermissions: ["requests.write"],
                buildingIds: [],
            },
            baseRole: "service_provider",
            status: "authenticated",
            permissionsReady: true,
        };
    });

    it("renders the provider profile route under /portal/profile", () => {
        pathname = "/portal/profile";

        const markup = renderToStaticMarkup(createElement(PortalRedirect, { slug: ["profile"] }));

        expect(markup).toContain("provider-profile-route");
    });

    it("renders the provider staff route under /portal/staff", () => {
        pathname = "/portal/staff";

        const markup = renderToStaticMarkup(createElement(PortalRedirect, { slug: ["staff"] }));

        expect(markup).toContain("provider-staff-route");
    });

    it("renders the provider dashboard route under /portal/dashboard", () => {
        pathname = "/portal/dashboard";
        authState = {
            ...authState,
            user: {
                ...authState.user,
                effectivePermissions: ["dashboard.read", "requests.write"],
            },
        };

        const markup = renderToStaticMarkup(createElement(PortalRedirect, { slug: ["dashboard"] }));

        expect(markup).toContain("provider-dashboard-route");
    });

    it("renders the owner notifications route under /portal/notifications", () => {
        pathname = "/portal/notifications";
        authState = {
            user: {
                id: "owner-user-1",
                role: "owner",
                baseRole: "owner",
                effectivePermissions: [],
                buildingIds: [],
            },
            baseRole: "owner",
            status: "authenticated",
            permissionsReady: true,
        };

        const markup = renderToStaticMarkup(createElement(PortalRedirect, { slug: ["notifications"] }));

        expect(markup).toContain("owner-notifications-route");
    });

    it("renders the owner dashboard route under /portal/dashboard", () => {
        pathname = "/portal/dashboard";
        authState = {
            user: {
                id: "owner-user-1",
                role: "owner",
                baseRole: "owner",
                effectivePermissions: [],
                buildingIds: [],
            },
            baseRole: "owner",
            status: "authenticated",
            permissionsReady: true,
        };

        const markup = renderToStaticMarkup(createElement(PortalRedirect, { slug: ["dashboard"] }));

        expect(markup).toContain("owner-dashboard-route");
    });
});
