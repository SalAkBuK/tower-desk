import type {
    DashboardActivityItem,
    DashboardActivityResponse,
    DashboardBroadcastsTrendPoint,
    DashboardBuildingSummary,
    DashboardMaintenanceTrendPoint,
    DashboardOverviewResponse,
    DashboardOverviewSummary,
    DashboardOverviewTrends,
    DashboardVisitorsTrendPoint,
} from "../types";
import { delay, USE_MOCK } from "./config";
import { fetchJson } from "./client";
import { getArray } from "./shared";

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toSummary = (value: any): DashboardOverviewSummary => ({
    buildingsTotal: toNumber(value?.buildingsTotal),
    unitsTotal: toNumber(value?.unitsTotal),
    occupiedUnits: toNumber(value?.occupiedUnits),
    vacantUnits: toNumber(value?.vacantUnits),
    occupancyRate: toNumber(value?.occupancyRate),
    activeLeases: toNumber(value?.activeLeases),
    openMaintenanceRequests: toNumber(value?.openMaintenanceRequests),
    overdueMaintenanceRequests: toNumber(value?.overdueMaintenanceRequests),
    visitorsToday: toNumber(value?.visitorsToday),
    activeParkingAllocations: toNumber(value?.activeParkingAllocations),
    broadcastsLast30Days: toNumber(value?.broadcastsLast30Days),
    unreadNotifications: toNumber(value?.unreadNotifications),
});

const toMaintenanceTrendPoint = (value: any): DashboardMaintenanceTrendPoint => ({
    date: String(value?.date ?? ""),
    created: toNumber(value?.created),
    completed: toNumber(value?.completed),
});

const toVisitorsTrendPoint = (value: any): DashboardVisitorsTrendPoint => ({
    date: String(value?.date ?? ""),
    created: toNumber(value?.created),
});

const toBroadcastsTrendPoint = (value: any): DashboardBroadcastsTrendPoint => ({
    date: String(value?.date ?? ""),
    sent: toNumber(value?.sent),
    recipientCount: toNumber(value?.recipientCount),
});

const toTrends = (value: any): DashboardOverviewTrends => ({
    maintenance: getArray(value?.maintenance).map(toMaintenanceTrendPoint),
    visitors: getArray(value?.visitors).map(toVisitorsTrendPoint),
    broadcasts: getArray(value?.broadcasts).map(toBroadcastsTrendPoint),
});

const toBuildingSummary = (value: any): DashboardBuildingSummary => ({
    buildingId: String(value?.buildingId ?? value?.id ?? ""),
    buildingName: String(value?.buildingName ?? value?.name ?? "Building"),
    totalUnits: toNumber(value?.totalUnits),
    occupiedUnits: toNumber(value?.occupiedUnits),
    vacantUnits: toNumber(value?.vacantUnits),
    occupancyRate: toNumber(value?.occupancyRate),
    activeLeases: toNumber(value?.activeLeases),
    openMaintenanceRequests: toNumber(value?.openMaintenanceRequests),
    activeParkingAllocations: toNumber(value?.activeParkingAllocations),
    parkingSlotsTotal: toNumber(value?.parkingSlotsTotal),
});

const toActivityItem = (value: any): DashboardActivityItem => ({
    type: String(value?.type ?? ""),
    title: String(value?.title ?? "Activity"),
    description: value?.description ? String(value.description) : undefined,
    entityType: value?.entityType ? String(value.entityType) : undefined,
    entityId: value?.entityId ? String(value.entityId) : undefined,
    buildingId: value?.buildingId ? String(value.buildingId) : undefined,
    buildingName: value?.buildingName ? String(value.buildingName) : undefined,
    occurredAt: String(value?.occurredAt ?? value?.createdAt ?? ""),
    metadata: value?.metadata && typeof value.metadata === "object" ? value.metadata : null,
});

const mockOverview: DashboardOverviewResponse = {
    generatedAt: new Date().toISOString(),
    summary: {
        buildingsTotal: 4,
        unitsTotal: 446,
        occupiedUnits: 398,
        vacantUnits: 48,
        occupancyRate: 89.24,
        activeLeases: 401,
        openMaintenanceRequests: 17,
        overdueMaintenanceRequests: 4,
        visitorsToday: 13,
        activeParkingAllocations: 182,
        broadcastsLast30Days: 6,
        unreadNotifications: 9,
    },
    trends: {
        maintenance: [
            { date: "2026-03-28", created: 3, completed: 1 },
            { date: "2026-03-29", created: 4, completed: 2 },
            { date: "2026-03-30", created: 2, completed: 5 },
            { date: "2026-03-31", created: 5, completed: 4 },
            { date: "2026-04-01", created: 3, completed: 3 },
            { date: "2026-04-02", created: 6, completed: 4 },
            { date: "2026-04-03", created: 2, completed: 2 },
        ],
        visitors: [
            { date: "2026-03-28", created: 8 },
            { date: "2026-03-29", created: 6 },
            { date: "2026-03-30", created: 11 },
            { date: "2026-03-31", created: 9 },
            { date: "2026-04-01", created: 7 },
            { date: "2026-04-02", created: 15 },
            { date: "2026-04-03", created: 13 },
        ],
        broadcasts: [
            { date: "2026-03-28", sent: 0, recipientCount: 0 },
            { date: "2026-03-29", sent: 1, recipientCount: 220 },
            { date: "2026-03-30", sent: 0, recipientCount: 0 },
            { date: "2026-03-31", sent: 2, recipientCount: 540 },
            { date: "2026-04-01", sent: 1, recipientCount: 180 },
            { date: "2026-04-02", sent: 1, recipientCount: 260 },
            { date: "2026-04-03", sent: 1, recipientCount: 140 },
        ],
    },
    buildings: [
        {
            buildingId: "b1",
            buildingName: "Tower One",
            totalUnits: 128,
            occupiedUnits: 117,
            vacantUnits: 11,
            occupancyRate: 91.41,
            activeLeases: 118,
            openMaintenanceRequests: 5,
            activeParkingAllocations: 52,
            parkingSlotsTotal: 80,
        },
        {
            buildingId: "b2",
            buildingName: "Skyline Heights",
            totalUnits: 96,
            occupiedUnits: 81,
            vacantUnits: 15,
            occupancyRate: 84.38,
            activeLeases: 82,
            openMaintenanceRequests: 7,
            activeParkingAllocations: 38,
            parkingSlotsTotal: 60,
        },
    ],
};

const mockActivity: DashboardActivityResponse = {
    items: [
        {
            type: "maintenance.created",
            title: "Maintenance request created",
            description: "Unit 1204 reported a cooling issue.",
            entityType: "maintenance_request",
            entityId: "req-1",
            buildingId: "b1",
            buildingName: "Tower One",
            occurredAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
            metadata: { priority: "high" },
        },
        {
            type: "visitor.created",
            title: "Visitor check-in scheduled",
            description: "Guest pass created for Unit 808.",
            entityType: "visitor",
            entityId: "visit-1",
            buildingId: "b2",
            buildingName: "Skyline Heights",
            occurredAt: new Date(Date.now() - 1000 * 60 * 84).toISOString(),
            metadata: null,
        },
    ],
    nextCursor: null,
};

export async function getDashboardOverview(): Promise<DashboardOverviewResponse> {
    if (!USE_MOCK) {
        const response = await fetchJson("/org/dashboard/overview");
        const payload = response?.data ?? response ?? {};
        return {
            generatedAt: payload?.generatedAt ? String(payload.generatedAt) : undefined,
            summary: toSummary(payload?.summary),
            trends: toTrends(payload?.trends),
            buildings: getArray(payload?.buildings).map(toBuildingSummary),
        };
    }

    await delay(800);
    return mockOverview;
}

export async function getDashboardActivity(limit = 20): Promise<DashboardActivityResponse> {
    if (!USE_MOCK) {
        const response = await fetchJson(`/org/dashboard/activity?limit=${encodeURIComponent(String(limit))}`);
        const payload = response?.data ?? response ?? {};
        return {
            items: getArray(payload?.items).map(toActivityItem),
            nextCursor: payload?.nextCursor ? String(payload.nextCursor) : null,
        };
    }

    await delay(800);
    return {
        items: mockActivity.items.slice(0, limit),
        nextCursor: null,
    };
}
