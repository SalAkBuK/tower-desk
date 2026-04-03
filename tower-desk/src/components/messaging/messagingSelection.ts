import type { Building } from "@/lib/types";

export function resolveComposerBuildingSelection(
    buildings: Building[],
    selectedBuildingId: string,
    hasSeededSelection: boolean
) {
    const preferredBuilding = buildings.find((building) => building.status === "active") ?? buildings[0];
    if (!preferredBuilding) {
        return {
            selectedBuildingId: "",
            hasSeededSelection,
        };
    }

    const hasValidSelection = selectedBuildingId
        ? buildings.some((building) => building.id === selectedBuildingId)
        : false;

    if (hasValidSelection) {
        return {
            selectedBuildingId,
            hasSeededSelection,
        };
    }

    if (!selectedBuildingId && hasSeededSelection) {
        return {
            selectedBuildingId: "",
            hasSeededSelection,
        };
    }

    return {
        selectedBuildingId: preferredBuilding.id,
        hasSeededSelection: true,
    };
}
