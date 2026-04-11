const normalizeResidentStatus = (status?: string | null) => String(status ?? "").trim().toUpperCase();
const normalizeLeaseStatus = (status?: string | null) => String(status ?? "").trim().toUpperCase();

export type AddContractResidentEligibilityInput = {
    isActive?: boolean;
    residentStatus?: string | null;
    hasActiveOccupancy?: boolean;
    leaseStatus?: string | null;
    canAddContract?: boolean;
    canRequestMoveIn?: boolean;
};

export const isResidentEligibleForNewContract = (resident: AddContractResidentEligibilityInput) => {
    if (resident.isActive === false) return false;
    if (resident.hasActiveOccupancy) return false;
    if (normalizeResidentStatus(resident.residentStatus) !== "NEW") return false;

    const leaseStatus = normalizeLeaseStatus(resident.leaseStatus);
    if (leaseStatus === "ACTIVE" || leaseStatus === "DRAFT") return false;
    if (resident.canAddContract === false) return false;
    if (resident.canRequestMoveIn === false) return false;

    return true;
};
