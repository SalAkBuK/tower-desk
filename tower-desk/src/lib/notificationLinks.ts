import type { NotificationItem } from "./types";
import { portalPath } from "./portalPaths";

const getStringValue = (value: unknown) => {
    if (typeof value !== "string") return "";
    return value.trim();
};

const getNotificationField = (notification: NotificationItem, ...keys: string[]) => {
    const data = notification.data ?? {};
    const sources: Array<Record<string, unknown>> = [data];

    const notificationRecord = notification as unknown as Record<string, unknown>;
    if (notificationRecord && typeof notificationRecord === "object") {
        sources.push(notificationRecord);
    }

    for (const source of sources) {
        for (const key of keys) {
            const resolved = getStringValue(source?.[key]);
            if (resolved) return resolved;
        }
    }

    return "";
};

export const getNotificationHref = (notification: NotificationItem) => {
    const directHref = getNotificationField(notification, "href", "path", "url", "link");
    if (directHref) {
        if (directHref.startsWith("/")) return directHref;
        if (/^https?:\/\//i.test(directHref)) return directHref;
    }

    const type = String(notification.type ?? "").toUpperCase();
    const buildingId = getNotificationField(notification, "buildingId", "building_id");
    const requestId = getNotificationField(notification, "requestId", "request_id");
    const moveRequestId = getNotificationField(notification, "moveRequestId", "move_request_id");
    const conversationId = getNotificationField(notification, "conversationId", "conversation_id");

    switch (type) {
        case "MOVE_IN_REQUEST_CREATED": {
            const params = new URLSearchParams({
                tab: "operations",
                section: "review",
                moveType: "move-in",
            });
            if (buildingId) params.set("buildingId", buildingId);
            if (moveRequestId || requestId) params.set("requestId", moveRequestId || requestId);
            return `${portalPath("contracts")}?${params.toString()}`;
        }
        case "MOVE_OUT_REQUEST_CREATED": {
            const params = new URLSearchParams({
                tab: "operations",
                section: "review",
                moveType: "move-out",
            });
            if (buildingId) params.set("buildingId", buildingId);
            if (moveRequestId || requestId) params.set("requestId", moveRequestId || requestId);
            return `${portalPath("contracts")}?${params.toString()}`;
        }
        case "REQUEST_CREATED":
        case "REQUEST_ASSIGNED":
        case "REQUEST_STATUS_CHANGED":
        case "REQUEST_COMMENTED":
        case "REQUEST_CANCELED":
        case "OWNER_APPROVAL_REQUESTED":
        case "OWNER_APPROVAL_APPROVED":
        case "OWNER_APPROVAL_REJECTED": {
            const params = new URLSearchParams();
            if (buildingId) params.set("buildingId", buildingId);
            if (requestId) params.set("requestId", requestId);
            const suffix = params.toString();
            return `${portalPath("requests")}${suffix ? `?${suffix}` : ""}`;
        }
        case "CONVERSATION_CREATED":
        case "MESSAGE_CREATED": {
            if (!conversationId) return portalPath("messages");
            return `${portalPath("messages")}?conversationId=${encodeURIComponent(conversationId)}`;
        }
        default:
            if (requestId) {
                const params = new URLSearchParams();
                if (buildingId) params.set("buildingId", buildingId);
                params.set("requestId", requestId);
                return `${portalPath("requests")}?${params.toString()}`;
            }
            return null;
    }
};
