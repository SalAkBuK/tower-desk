import { describe, expect, it } from "vitest";

import {
    SIDEBAR_COLLAPSED_STORAGE_KEY,
    readSidebarCollapsedPreference,
    writeSidebarCollapsedPreference,
} from "../../src/components/layout/sidebarState";

function createStorage() {
    const values = new Map<string, string>();

    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
            values.set(key, value);
        },
    };
}

describe("AppLayout sidebar preference helpers", () => {
    it("defaults to expanded when there is no saved preference", () => {
        const storage = createStorage();

        expect(readSidebarCollapsedPreference(storage)).toBe(false);
    });

    it("restores a collapsed preference from storage", () => {
        const storage = createStorage();
        storage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, "1");

        expect(readSidebarCollapsedPreference(storage)).toBe(true);
    });

    it("persists expanded and collapsed values using the shared storage key", () => {
        const storage = createStorage();

        writeSidebarCollapsedPreference(storage, true);
        expect(storage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("1");
        expect(readSidebarCollapsedPreference(storage)).toBe(true);

        writeSidebarCollapsedPreference(storage, false);
        expect(storage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("0");
        expect(readSidebarCollapsedPreference(storage)).toBe(false);
    });
});
