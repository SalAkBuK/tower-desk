export type LeasePageTab = "leases" | "pending";

export type LeaseActionId = "view" | "move_out" | "transfer";
export type OrgLeaseListStatus = "ACTIVE" | "ENDED" | "ALL";

const DEFAULT_LEASES_BASE_PATH = "/portal/leases";

export function buildLeasesHref({
    basePath = DEFAULT_LEASES_BASE_PATH,
    buildingId,
    tab = "leases",
    status,
    q,
}: {
    basePath?: string;
    buildingId?: string;
    tab?: LeasePageTab;
    status?: OrgLeaseListStatus;
    q?: string;
}) {
    const params = new URLSearchParams();
    const trimmedQuery = q?.trim();
    if (buildingId) params.set("buildingId", buildingId);
    if (tab === "pending") params.set("tab", "pending");
    if (status && status !== "ALL") params.set("status", status);
    if (trimmedQuery) params.set("q", trimmedQuery);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
}

export function resolveLeasesLandingTabFromResidentFilter(statusFilter: string): LeasePageTab {
    return statusFilter === "NEW" ? "pending" : "leases";
}

export function resolveResidentLeaseModuleHref({
    leaseBasePath = DEFAULT_LEASES_BASE_PATH,
    effectiveBuildingId,
    residentQuery,
    residentStatus,
}: {
    leaseBasePath?: string;
    effectiveBuildingId?: string;
    residentQuery?: string;
    residentStatus?: "ACTIVE" | "NEW" | "FORMER" | string | null;
}) {
    const normalizedStatus = String(residentStatus || "").toUpperCase();
    const tab: LeasePageTab = normalizedStatus === "NEW" ? "pending" : "leases";
    const statusFilter: OrgLeaseListStatus | undefined =
        normalizedStatus === "ACTIVE"
            ? "ACTIVE"
            : normalizedStatus === "FORMER"
                ? "ENDED"
                : undefined;
    return buildLeasesHref({
        basePath: leaseBasePath,
        buildingId: effectiveBuildingId || undefined,
        tab,
        status: statusFilter,
        q: residentQuery,
    });
}

export function resolveUnitLeaseManagementHref({
    buildingId,
    query,
    leaseBasePath = DEFAULT_LEASES_BASE_PATH,
}: {
    buildingId: string;
    query?: string;
    leaseBasePath?: string;
}) {
    return buildLeasesHref({
        basePath: leaseBasePath,
        buildingId,
        tab: "leases",
        q: query,
    });
}

export function getLeaseActionIds(status?: string | null): LeaseActionId[] {
    return status === "ACTIVE"
        ? ["view", "move_out", "transfer"]
        : ["view"];
}
