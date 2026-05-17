import { describe, expect, it } from "vitest";

import { getNotificationHref } from "../../src/lib/notificationLinks";

describe("notification deep links", () => {
    it("routes move-out notifications into the contracts operations workspace", () => {
        expect(getNotificationHref({
            id: "notification-1",
            type: "MOVE_OUT_REQUEST_CREATED",
            title: "Move-out request received",
            data: {
                buildingId: "building-1",
                moveRequestId: "move-request-1",
            },
        })).toBe("/portal/contracts?tab=operations&section=review&moveType=move-out&buildingId=building-1&requestId=move-request-1");
    });

    it("routes request notifications to the request detail selection query", () => {
        expect(getNotificationHref({
            id: "notification-2",
            type: "REQUEST_COMMENTED",
            title: "New request comment",
            data: {
                requestId: "request-1",
                buildingId: "building-1",
            },
        })).toBe("/portal/requests?buildingId=building-1&requestId=request-1");
    });

    it("routes owner maintenance notices to the owner request detail", () => {
        expect(getNotificationHref({
            id: "notification-owner-notice",
            type: "OWNER_MAINTENANCE_NOTICE",
            title: "Maintenance notice",
            data: {
                requestId: "request-7",
                buildingId: "building-1",
                ownerApprovalStatus: "NOT_REQUIRED",
                requiresOwnerApproval: false,
            },
        })).toBe("/portal/requests?buildingId=building-1&requestId=request-7");
    });

    it("routes message notifications to the matching conversation", () => {
        expect(getNotificationHref({
            id: "notification-3",
            type: "MESSAGE_CREATED",
            title: "New message",
            data: {
                conversationId: "conversation-1",
            },
        })).toBe("/portal/messages?conversationId=conversation-1");
    });

    it("prefers an explicit backend href when present", () => {
        expect(getNotificationHref({
            id: "notification-4",
            type: "CUSTOM",
            title: "Custom",
            data: {
                href: "/portal/contracts/contract-1?tab=history",
            },
        })).toBe("/portal/contracts/contract-1?tab=history");
    });

    it("routes unknown request workflow notifications when the backend includes request context", () => {
        expect(getNotificationHref({
            id: "notification-5",
            type: "REQUEST_PROVIDER_UNASSIGNED",
            title: "Provider removed",
            data: {
                requestId: "request-9",
                buildingId: "building-2",
            },
        })).toBe("/portal/requests?buildingId=building-2&requestId=request-9");
    });
});
