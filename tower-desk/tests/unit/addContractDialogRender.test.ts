import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let createPending = false;

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

vi.mock("@/lib/auth", () => ({
    useAuth: () => ({
        user: { id: "user-1" },
        baseRole: "manager",
    }),
}));

vi.mock("@/lib/queries", () => ({
    useCreateContract: () => ({
        isPending: createPending,
        mutateAsync: vi.fn(),
    }),
    useAccessibleBuildings: () => ({
        data: [{ id: "building-1", name: "Tower One" }],
    }),
    useOwners: () => ({
        data: [{ id: "owner-1", name: "Owner One", email: "owner@example.com", phone: "0500000000" }],
    }),
    useUnitTypes: () => ({
        data: [{ id: "type-1", name: "Apartment" }],
    }),
    useBuildingUnits: () => ({
        data: [{ id: "unit-1", label: "101", floor: 1, occupancy: null, ownerId: "owner-1", rentAnnual: 48000, unitTypeId: "type-1" }],
        isError: false,
        isFetching: false,
        isLoading: false,
    }),
    useBuildingOccupancies: () => ({
        data: [],
        isError: false,
    }),
    useOrgResidents: () => ({
        data: {
            items: [{
                user: {
                    id: "resident-1",
                    name: "Jane Doe",
                    email: "jane@example.com",
                    phoneNumber: "0501234567",
                    isActive: true,
                },
                residentProfile: {
                    emiratesIdNumber: "784-1987-1234567-1",
                    nationality: "Pakistani",
                    emergencyContactName: "John Doe",
                },
                canAddContract: true,
                lease: null,
            }],
        },
        isError: false,
        isFetching: false,
        isLoading: false,
    }),
    useBuildingUnit: () => ({
        data: null,
    }),
}));

const { AddContractDialog } = await import("../../src/components/leases/AddContractDialog");

describe("AddContractDialog render", () => {
    beforeEach(() => {
        createPending = false;
    });

    it("renders the redesigned contract sections with commercial and advanced details collapsed by default", () => {
        const markup = renderToStaticMarkup(createElement(AddContractDialog, {
            open: true,
            onOpenChange: vi.fn(),
            buildingId: "building-1",
        }));

        expect(markup).toContain("Assignment");
        expect(markup).toContain("Contract Essentials");
        expect(markup).toContain("Commercial / Legal");
        expect(markup).toContain("Advanced Snapshot Details");
        expect(markup).toContain("Create draft contract");
        expect(markup).toContain("Contract Period From");
        expect(markup).toContain("Contract Period To");
        expect(markup).toContain("Collapsed");
        expect(markup).not.toContain("Contract Date");
        expect(markup).not.toContain("Date the contract was signed or issued.");
        expect(markup).not.toContain("Building Name");
    });

    it("shows the pending primary action copy while creation is in progress", () => {
        createPending = true;

        const markup = renderToStaticMarkup(createElement(AddContractDialog, {
            open: true,
            onOpenChange: vi.fn(),
            buildingId: "building-1",
        }));

        expect(markup).toContain("Creating draft...");
    });
});
