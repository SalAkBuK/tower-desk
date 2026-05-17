import { afterEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "http://localhost:3001/api";

async function loadShared() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
    return import("../../src/lib/api/shared");
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("contract notification copy", () => {
    it("maps move request notification titles and bodies", async () => {
        const { getNotificationBody, getNotificationTitle } = await loadShared();

        expect(getNotificationTitle("MOVE_IN_REQUEST_CREATED")).toBe("Move-in request received");
        expect(getNotificationBody("MOVE_IN_REQUEST_CREATED")).toContain("move-in request");

        expect(getNotificationTitle("MOVE_OUT_REQUEST_CREATED")).toBe("Move-out request received");
        expect(getNotificationBody("MOVE_OUT_REQUEST_CREATED")).toContain("move-out request");
    });

    it("fills fallback title/body when the backend sends only the type", async () => {
        const { mapNotification } = await loadShared();

        const notification = mapNotification({
            id: "n-1",
            type: "MOVE_IN_REQUEST_CREATED",
        });

        expect(notification.title).toBe("Move-in request received");
        expect(notification.body).toContain("move-in request");
    });

    it("maps owner approval payload fields from notifications", async () => {
        const { mapNotification } = await loadShared();

        const notification = mapNotification({
            id: "n-2",
            type: "OWNER_APPROVAL_APPROVED",
            data: {
                ownerApprovalStatus: "APPROVED",
                isEmergency: true,
            },
        });

        expect(notification.title).toBe("Owner approved request");
        expect(notification.ownerApprovalStatus).toBe("APPROVED");
        expect(notification.isEmergency).toBe(true);
    });

    it("maps owner maintenance notice fallback copy and FYI payload fields", async () => {
        const { mapNotification } = await loadShared();

        const notification = mapNotification({
            id: "n-3",
            type: "OWNER_MAINTENANCE_NOTICE",
            data: {
                ownerApprovalStatus: "NOT_REQUIRED",
                isEmergency: false,
                requiresOwnerApproval: false,
            },
        });

        expect(notification.title).toBe("Maintenance notice");
        expect(notification.body).toContain("shared for your information");
        expect(notification.ownerApprovalStatus).toBe("NOT_REQUIRED");
        expect(notification.isEmergency).toBe(false);
    });
});
