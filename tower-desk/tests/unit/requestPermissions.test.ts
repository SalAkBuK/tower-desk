import { describe, expect, it } from "vitest";

import { canAssignRequests, canCommentOnRequests, canUpdateRequestStatuses } from "../../src/lib/requestPermissions";

describe("request permissions", () => {
    it("allows granular request actions without relying on role", () => {
        const permissionSet = new Set(["requests.assign", "requests.comment", "requests.update_status"]);

        expect(canAssignRequests(permissionSet)).toBe(true);
        expect(canCommentOnRequests(permissionSet)).toBe(true);
        expect(canUpdateRequestStatuses(permissionSet)).toBe(true);
    });

    it("treats requests.write as a write-capability umbrella", () => {
        const permissionSet = new Set(["requests.write"]);

        expect(canAssignRequests(permissionSet)).toBe(true);
        expect(canCommentOnRequests(permissionSet)).toBe(true);
        expect(canUpdateRequestStatuses(permissionSet)).toBe(true);
    });

    it("does not promote requests.read into write actions", () => {
        const permissionSet = new Set(["requests.read"]);

        expect(canAssignRequests(permissionSet)).toBe(false);
        expect(canCommentOnRequests(permissionSet)).toBe(false);
        expect(canUpdateRequestStatuses(permissionSet)).toBe(false);
    });
});
