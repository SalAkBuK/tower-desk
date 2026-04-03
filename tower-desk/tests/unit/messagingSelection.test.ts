import { describe, expect, it } from "vitest";

import { resolveComposerBuildingSelection } from "../../src/components/messaging/messagingSelection";

describe("resolveComposerBuildingSelection", () => {
    const buildings = [
        { id: "building-1", name: "Building 1", status: "maintenance" as const },
        { id: "building-2", name: "Building 2", status: "active" as const },
        { id: "building-3", name: "Building 3", status: "inactive" as const },
    ];

    it("prefers an active building when there is no current selection", () => {
        expect(resolveComposerBuildingSelection(buildings, "", false)).toEqual({
            selectedBuildingId: "building-2",
            hasSeededSelection: true,
        });
    });

    it("keeps a valid selection intact", () => {
        expect(resolveComposerBuildingSelection(buildings, "building-3", true)).toEqual({
            selectedBuildingId: "building-3",
            hasSeededSelection: true,
        });
    });

    it("preserves a user-cleared selection after seeding", () => {
        expect(resolveComposerBuildingSelection(buildings, "", true)).toEqual({
            selectedBuildingId: "",
            hasSeededSelection: true,
        });
    });
});
