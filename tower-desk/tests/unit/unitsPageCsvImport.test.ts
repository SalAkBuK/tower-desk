import { afterEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "https://example.test/api";

describe("units csv normalization", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("keeps unitType as the active org name instead of rewriting it to an internal id", async () => {
        vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE_URL);
        const { normalizeUnitsCsvFile } = await import("../../src/lib/unitsImportCsv");

        const file = new File(
            [
                [
                    "label,unitType,unitSizeUnit",
                    "A-101,Apartment,SQ_FT",
                    "A-102, duplex ,sq ft",
                ].join("\n"),
            ],
            "units.csv",
            { type: "text/csv" }
        );

        const normalized = await normalizeUnitsCsvFile(file, [
            { id: "298ed544-24f6-4d93-b424-f2c40e07bfd7", name: "Apartment" },
            { id: "da073551-46d2-40fa-9416-a59fdc981c6c", name: "Duplex" },
        ]);

        await expect(normalized.text()).resolves.toBe(
            [
                "label,unitType,unitSizeUnit",
                "A-101,Apartment,SQ_FT",
                "A-102,Duplex,SQ_FT",
            ].join("\n")
        );
    });
});
