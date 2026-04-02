import { describe, expect, it } from "vitest";

import { getNotificationBody, getNotificationTitle, mapNotification } from "../../src/lib/api/shared";

describe("contract notification copy", () => {
    it("maps move request notification titles and bodies", () => {
        expect(getNotificationTitle("MOVE_IN_REQUEST_CREATED")).toBe("Move-in request received");
        expect(getNotificationBody("MOVE_IN_REQUEST_CREATED")).toContain("move-in request");

        expect(getNotificationTitle("MOVE_OUT_REQUEST_CREATED")).toBe("Move-out request received");
        expect(getNotificationBody("MOVE_OUT_REQUEST_CREATED")).toContain("move-out request");
    });

    it("fills fallback title/body when the backend sends only the type", () => {
        const notification = mapNotification({
            id: "n-1",
            type: "MOVE_IN_REQUEST_CREATED",
        });

        expect(notification.title).toBe("Move-in request received");
        expect(notification.body).toContain("move-in request");
    });
});
