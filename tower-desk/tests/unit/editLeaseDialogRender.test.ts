import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lease } from "../../src/lib/types";

let updatePending = false;

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/components/ui/dialog", () => ({
    Dialog: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => createElement("div", { className }, children),
    DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => createElement("div", { className }, children),
    DialogTitle: ({ children, className }: { children: ReactNode; className?: string }) => createElement("h2", { className }, children),
    DialogDescription: ({ children, className }: { children: ReactNode; className?: string }) => createElement("p", { className }, children),
}));

vi.mock("@/lib/queries", () => ({
    useUpdateLease: () => ({
        isPending: updatePending,
        mutateAsync: vi.fn(),
    }),
}));

const { EditLeaseDialog } = await import("../../src/components/leases/EditLeaseDialog");

const lease = {
    id: "lease-1",
    status: "ACTIVE",
    residentUserId: "9d2a8e10-9d8a-4f3d-8fd3-6a8f00db9e11",
    resident: {
        name: "Jane Doe",
        email: "jane@example.com",
    },
    tenantPhoneSnapshot: "0501234567",
    buildingNameSnapshot: "Tower One",
    locationCommunity: "Downtown",
    unitId: "f2a92bde-aef2-452d-9027-31b7aa1292d2",
    unit: {
        label: "101",
        floor: 12,
    },
    paymentFrequency: "QUARTERLY",
    annualRent: "48000.00",
    ijariId: "EJ-123",
    additionalTerms: ["No subletting"],
} as Lease;

describe("EditLeaseDialog render", () => {
    beforeEach(() => {
        updatePending = false;
    });

    it("renders the redesigned edit sections with disclosures collapsed by default", () => {
        const markup = renderToStaticMarkup(createElement(EditLeaseDialog, {
            open: true,
            onOpenChange: vi.fn(),
            lease,
        }));

        expect(markup).toContain("Assignment");
        expect(markup).toContain("Contract Essentials");
        expect(markup).toContain("Commercial / Legal");
        expect(markup).toContain("Advanced Snapshot Details");
        expect(markup).toContain("Operational Details");
        expect(markup).toContain("Save changes");
        expect(markup).toContain("Contract Period From");
        expect(markup).toContain("Contract Period To");
        expect(markup).toContain("Collapsed");
        expect(markup).not.toContain("Contract Date");
        expect(markup).not.toContain("Date the contract was signed or issued.");
        expect(markup).toContain("jane@example.com");
        expect(markup).toContain("0501234567");
        expect(markup).toContain("Tower One");
        expect(markup).toContain("Floor 12");
        expect(markup).not.toContain("9d2a8e10-9d8a-4f3d-8fd3-6a8f00db9e11");
        expect(markup).not.toContain("f2a92bde-aef2-452d-9027-31b7aa1292d2");
        expect(markup).not.toContain("Tenant Name");
    });

    it("shows the pending primary action copy while save is in progress", () => {
        updatePending = true;

        const markup = renderToStaticMarkup(createElement(EditLeaseDialog, {
            open: true,
            onOpenChange: vi.fn(),
            lease,
        }));

        expect(markup).toContain("Saving...");
    });
});
