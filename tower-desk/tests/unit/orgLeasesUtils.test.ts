import { describe, expect, it } from "vitest";
import type { ContractMoveRequest, Lease } from "../../src/lib/types";
import {
    formatDate,
    formatMoney,
    getLeaseActionAvailability,
    getLeaseBadgeLabel,
    getLeaseBadgeStatus,
    getMoveRequestRowMeta,
    groupLeasesByResident,
} from "../../src/components/leases/org-leases/utils";

const lease = (overrides: Partial<Lease> = {}): Lease => ({
    id: "lease-1",
    buildingId: "building-1",
    unitId: "unit-1",
    residentUserId: "resident-1",
    status: "ACTIVE",
    annualRent: 120000,
    leaseStartDate: "2026-01-01T00:00:00.000Z",
    leaseEndDate: "2026-12-31T00:00:00.000Z",
    resident: {
        id: "resident-1",
        name: "Alex Resident",
        email: "alex@example.com",
    },
    unit: {
        label: "A-101",
    },
    ...overrides,
} as Lease);

const moveRequest = (overrides: Partial<ContractMoveRequest> = {}): ContractMoveRequest => ({
    id: "request-1",
    contractId: "lease-1",
    leaseId: "lease-1",
    status: "PENDING",
    requestedMoveAt: "2026-03-01T08:00:00.000Z",
    ...overrides,
} as ContractMoveRequest);

describe("groupLeasesByResident", () => {
    it("groups leases by resident and sorts active/latest contracts first", () => {
        const groups = groupLeasesByResident([
            lease({ id: "lease-older", leaseStartDate: "2025-01-01T00:00:00.000Z" }),
            lease({ id: "lease-newer", leaseStartDate: "2026-02-01T00:00:00.000Z" }),
            lease({
                id: "lease-other",
                residentUserId: "resident-2",
                resident: { id: "resident-2", name: "Jamie Tenant", email: "jamie@example.com" },
                status: "ENDED",
                leaseStartDate: "2024-01-01T00:00:00.000Z",
            }),
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0].residentName).toBe("Alex Resident");
        expect(groups[0].leases.map((item) => item.id)).toEqual(["lease-newer", "lease-older"]);
        expect(groups[0].activeLeases).toBe(2);
    });
});

describe("lease and move-request helpers", () => {
    it("derives contract action availability without changing permissions", () => {
        expect(getLeaseActionAvailability(lease({ status: "DRAFT" }), true)).toEqual({
            canActivateContract: true,
            canCancelContract: true,
            canEditContract: true,
        });
        expect(getLeaseActionAvailability(lease({ status: "ACTIVE" }), false)).toEqual({
            canActivateContract: false,
            canCancelContract: false,
            canEditContract: false,
        });
    });

    it("derives move request row actions from status and contract linkage", () => {
        expect(getMoveRequestRowMeta(moveRequest({ status: "PENDING" }))).toEqual({
            requestContractId: "lease-1",
            canApproveReject: true,
            canExecute: false,
        });
        expect(getMoveRequestRowMeta(moveRequest({ status: "APPROVED", contractId: undefined, leaseId: undefined }))).toEqual({
            requestContractId: undefined,
            canApproveReject: false,
            canExecute: false,
        });
    });

    it("prefers display status for contract badges", () => {
        expect(
            getLeaseBadgeStatus(lease({ status: "CANCELLED", displayStatus: "MOVED_OUT" }))
        ).toBe("MOVED_OUT");
        expect(
            getLeaseBadgeLabel(lease({ status: "CANCELLED", displayStatus: "MOVED_OUT" }))
        ).toBe("Moved Out");
    });
});

describe("format helpers", () => {
    it("formats common lease values consistently", () => {
        expect(formatDate("2026-01-15T00:00:00.000Z")).toContain("2026");
        expect(formatMoney(12500)).toBe("12,500");
    });
});
