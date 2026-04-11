import type { Broadcast, BroadcastAudience, BroadcastMetadata, BroadcastScope, NotificationItem } from "@/lib/types";

const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
    tenants: "Tenants",
    admins: "Admins",
    staff: "Staff",
    managers: "Managers",
    building_admins: "Building admins",
    all_users: "All users",
};

const SCOPE_LABELS: Record<BroadcastScope, string> = {
    single_building: "Single building",
    multi_building: "Multi-building",
    org_wide: "Org-wide",
};

const asTrimmedString = (value: unknown) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
};

const asNonNegativeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const mapAudience = (value: unknown): BroadcastAudience | null => {
    const normalized = asTrimmedString(value)?.toLowerCase();
    switch (normalized) {
        case "tenants":
            return "tenants";
        case "admins":
            return "admins";
        case "staff":
            return "staff";
        case "managers":
            return "managers";
        case "building_admins":
        case "building-admins":
        case "buildingadmins":
            return "building_admins";
        case "all_users":
        case "all-users":
        case "allusers":
            return "all_users";
        default:
            return null;
    }
};

export const normalizeBroadcastScope = (value: unknown): BroadcastScope | null => {
    const normalized = asTrimmedString(value)?.toLowerCase();
    switch (normalized) {
        case "single_building":
        case "single-building":
        case "singlebuilding":
            return "single_building";
        case "multi_building":
        case "multi-building":
        case "multibuilding":
            return "multi_building";
        case "org_wide":
        case "org-wide":
        case "orgwide":
            return "org_wide";
        default:
            return null;
    }
};

export const normalizeBroadcastAudiences = (value: unknown): BroadcastAudience[] => {
    if (Array.isArray(value)) {
        return value
            .map((entry) => mapAudience((entry as { key?: unknown; value?: unknown; type?: unknown })?.key ?? (entry as { key?: unknown; value?: unknown; type?: unknown })?.value ?? (entry as { key?: unknown; value?: unknown; type?: unknown })?.type ?? entry))
            .filter((entry): entry is BroadcastAudience => Boolean(entry));
    }
    const single = mapAudience(value);
    return single ? [single] : [];
};

const inferScope = (buildingCount: number): BroadcastScope => {
    if (buildingCount <= 0) return "org_wide";
    if (buildingCount === 1) return "single_building";
    return "multi_building";
};

export const mapBroadcastMetadata = (
    value: unknown,
    fallback?: {
        audiences?: unknown;
        buildingIds?: string[];
    }
): BroadcastMetadata => {
    const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const fallbackBuildingIds = (fallback?.buildingIds ?? []).map((entry) => String(entry)).filter(Boolean);
    const fallbackAudiences = normalizeBroadcastAudiences(fallback?.audiences);
    const metadataAudiences = normalizeBroadcastAudiences(source.audiences ?? source.audience);
    const buildingCount = asNonNegativeNumber(source.buildingCount) ?? fallbackBuildingIds.length;
    const audiences = metadataAudiences.length > 0 ? metadataAudiences : fallbackAudiences;
    const scope = normalizeBroadcastScope(source.scope) ?? inferScope(buildingCount);
    const audienceSummary = asTrimmedString(source.audienceSummary)
        ?? (audiences.length > 0 ? audiences.map((entry) => AUDIENCE_LABELS[entry]).join(", ") : "Recipients");

    return {
        audiences,
        scope,
        buildingCount,
        audienceSummary,
    };
};

export const getBroadcastAudienceLabel = (value: BroadcastAudience) => AUDIENCE_LABELS[value] ?? value;

export const getBroadcastScopeLabel = (value: BroadcastScope) => SCOPE_LABELS[value] ?? value;

export const getBroadcastMetadata = (broadcast?: Broadcast | null) =>
    mapBroadcastMetadata(broadcast?.metadata, {
        audiences: broadcast?.audiences,
        buildingIds: broadcast?.buildingIds ?? [],
    });

export const getBroadcastNotificationMetadata = (notification?: NotificationItem | null) => {
    const data = notification?.data;
    if (!data || typeof data !== "object") return null;

    const typedData = data as Record<string, unknown>;
    const broadcastId = asTrimmedString(typedData.broadcastId);
    const metadata = typedData.metadata;
    const rawBuildingIds = Array.isArray(typedData.buildingIds)
        ? typedData.buildingIds.map((entry) => String(entry)).filter(Boolean)
        : [];

    if (!broadcastId && !metadata) return null;

    return mapBroadcastMetadata(metadata, {
        buildingIds: rawBuildingIds,
    });
};

