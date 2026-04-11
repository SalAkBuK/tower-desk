import { describe, expect, it } from "vitest";

import { isResidentEligibleForNewContract } from "../../src/components/leases/addContractResidentEligibility";

describe("isResidentEligibleForNewContract", () => {
    it("allows residents who are new, inactive in occupancy terms, and ready for a pre-move-in contract", () => {
        expect(isResidentEligibleForNewContract({
            isActive: true,
            residentStatus: "NEW",
            hasActiveOccupancy: false,
            leaseStatus: null,
            canAddContract: true,
            canRequestMoveIn: true,
        })).toBe(true);
    });

    it("excludes residents who are already active or already have a draft/active contract in flight", () => {
        expect(isResidentEligibleForNewContract({
            isActive: true,
            residentStatus: "ACTIVE",
            hasActiveOccupancy: true,
            leaseStatus: "ACTIVE",
            canAddContract: true,
            canRequestMoveIn: false,
        })).toBe(false);

        expect(isResidentEligibleForNewContract({
            isActive: true,
            residentStatus: "NEW",
            hasActiveOccupancy: false,
            leaseStatus: "DRAFT",
            canAddContract: true,
            canRequestMoveIn: false,
        })).toBe(false);
    });
});
