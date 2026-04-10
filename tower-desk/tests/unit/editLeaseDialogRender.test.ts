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
    residentUserId: "resident-1",
    resident: {
        name: "Jane Doe",
        email: "jane@example.com",
    },
    unitId: "unit-1",
    unit: {
        label: "101",
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
