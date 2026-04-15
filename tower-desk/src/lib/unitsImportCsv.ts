// Allow both legacy spreadsheet headers and the new canonical ones during CSV import.
const legacyUnitHeaderMap: Record<string, string> = {
    "unit number code": "label",
    "unit number": "label",
    "unit code": "label",
    "floor number": "floor",
    "unit type": "unitType",
    "number of bedrooms": "bedrooms",
    "bedrooms": "bedrooms",
    "number of bathrooms": "bathrooms",
    "bathrooms": "bathrooms",
    "unit size sq ft sq m": "unitSize",
    "unit size": "unitSize",
    "derived": "unitSizeUnit",
    "unit size unit": "unitSizeUnit",
    "balcony yes no": "balcony",
    "balcony": "balcony",
    "kitchen type open closed": "kitchenType",
    "kitchen type": "kitchenType",
    "furnished status unfurnished semi furnished fully furnished": "furnishedStatus",
    "furnished status": "furnishedStatus",
    "rent amount annual": "rentAnnual",
    "payment frequency payment monthly quartely semi annual": "paymentFrequency",
    "payment frequency": "paymentFrequency",
    "security deposit amount": "securityDepositAmount",
    "service charge per unit": "serviceChargePerUnit",
    "vat applicable yes no": "vatApplicable",
    "vat applicable": "vatApplicable",
    "maintenance paid by": "maintenancePayer",
    "electricity meter number": "electricityMeterNumber",
    "water meter number": "waterMeterNumber",
    "gas meter number if applicable": "gasMeterNumber",
    "gas meter number": "gasMeterNumber",
};

const preferredUnitHeaders = [
    "label",
    "floor",
    "unitType",
    "notes",
    "bedrooms",
    "bathrooms",
    "unitSize",
    "unitSizeUnit",
    "furnishedStatus",
    "balcony",
    "kitchenType",
    "rentAnnual",
    "paymentFrequency",
    "securityDepositAmount",
    "serviceChargePerUnit",
    "vatApplicable",
    "maintenancePayer",
    "electricityMeterNumber",
    "waterMeterNumber",
    "gasMeterNumber",
] as const;

const canonicalUnitHeader = (header: string) =>
    header
        .replace(/^\uFEFF/, "")
        .replace(/"/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const preferredHeaderLookup = new Map(preferredUnitHeaders.map((name) => [canonicalUnitHeader(name), name]));

export const canonicalUnitTypeValue = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const parseUnitsCsvContent = (content: string) => {
    const lines = content.split(/\r?\n/);
    if (lines.length === 0 || !lines[0]) {
        return {
            originalHeaders: [] as string[],
            normalizedHeaders: [] as string[],
            rows: [] as string[][],
        };
    }

    const firstLine = lines[0];
    const delimiter =
        firstLine.includes("\t") && (!firstLine.includes(",") || firstLine.split("\t").length >= firstLine.split(",").length)
            ? "\t"
            : ",";
    const splitRow = (row: string) => row.split(delimiter);

    const originalHeaderCells = splitRow(firstLine);
    const keepIndexes = originalHeaderCells
        .map((header, index) => (header.trim() === "" ? -1 : index))
        .filter((index) => index >= 0);

    const originalHeaders = keepIndexes.map((index) => originalHeaderCells[index].trim());
    const normalizedHeaders = originalHeaders.map((header) => {
        const canonical = canonicalUnitHeader(header);
        if (legacyUnitHeaderMap[canonical]) return legacyUnitHeaderMap[canonical];
        return preferredHeaderLookup.get(canonical) ?? header;
    });

    const rows = lines
        .slice(1)
        .filter((line) => line.trim())
        .map((line) => {
            const rawCells = splitRow(line);
            return keepIndexes.map((index) => rawCells[index] ?? "");
        });

    return { originalHeaders, normalizedHeaders, rows };
};

export const inspectUnitsCsvFile = async (file: File) => {
    const content = await file.text();
    const { normalizedHeaders, rows } = parseUnitsCsvContent(content);
    const unitTypeIndex = normalizedHeaders.findIndex((header) => header === "unitType");
    if (unitTypeIndex < 0) return [];

    const detected = new Map<string, string>();
    rows.forEach((row) => {
        const value = row[unitTypeIndex]?.trim();
        if (!value) return;
        const canonical = canonicalUnitTypeValue(value);
        if (!canonical || detected.has(canonical)) return;
        detected.set(canonical, value);
    });

    return Array.from(detected.values());
};

export const normalizeUnitsCsvFile = async (file: File, unitTypes?: { id: string; name: string }[]) => {
    const content = await file.text();
    const { originalHeaders, normalizedHeaders, rows } = parseUnitsCsvContent(content);
    if (originalHeaders.length === 0) return file;

    const unitTypeLookup =
        unitTypes && unitTypes.length
            ? new Map(unitTypes.map((type) => [type.name.trim().toLowerCase(), type.name.trim()]))
            : null;
    const unitTypeCanonicalLookup =
        unitTypes && unitTypes.length
            ? new Map(unitTypes.map((type) => [canonicalUnitTypeValue(type.name), type.name.trim()]))
            : null;
    const unitTypeIndex = normalizedHeaders.findIndex((header) => header === "unitType");
    const unitSizeIndex = normalizedHeaders.findIndex((header) => header === "unitSize");

    const normalizedHeaderSet = new Set(normalizedHeaders.map(canonicalUnitHeader));
    if (!normalizedHeaderSet.has(canonicalUnitHeader("unitSizeUnit"))) {
        normalizedHeaders.push("unitSizeUnit");
    }
    const unitSizeUnitIndex = normalizedHeaders.findIndex((header) => header === "unitSizeUnit");

    const normalizeUnitSizeUnit = (value: string) => {
        const raw = value.trim();
        if (!raw) return { unit: "SQ_FT", isSqM: false, recognized: true };

        const normalized = raw
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");

        if (normalized === "SQ_FT" || normalized === "SQFT" || normalized === "FT2" || normalized === "FT") {
            return { unit: "SQ_FT", isSqM: false, recognized: true };
        }
        if (
            normalized === "SQ_M" ||
            normalized === "SQM" ||
            normalized === "M2" ||
            normalized === "M_2" ||
            normalized === "SQUARE_METER" ||
            normalized === "SQUARE_METERS"
        ) {
            return { unit: "SQ_M", isSqM: true, recognized: true };
        }
        return { unit: raw, isSqM: false, recognized: false };
    };

    const changed = normalizedHeaders.some((header, index) => header !== originalHeaders[index]);
    const needsPad = normalizedHeaders.length !== originalHeaders.length;
    let hasRowChanges = false;

    const normalizedRows = rows.map((originalCells) => {
        const cells = [...originalCells];

        if (unitTypeLookup && unitTypeIndex >= 0 && cells[unitTypeIndex]) {
            const rawValue = cells[unitTypeIndex].trim();
            const matchName =
                unitTypeLookup.get(rawValue.toLowerCase()) ??
                unitTypeCanonicalLookup?.get(canonicalUnitTypeValue(rawValue)) ??
                null;
            // Backend import resolves unit types by active org name, not by internal id.
            if (matchName) cells[unitTypeIndex] = matchName;
        }

        if (unitSizeUnitIndex >= 0) {
            const { unit, isSqM, recognized } = normalizeUnitSizeUnit(cells[unitSizeUnitIndex] ?? "");
            if (isSqM && unitSizeIndex >= 0 && cells[unitSizeIndex]) {
                const parsedSize = parseFloat(cells[unitSizeIndex].replace(/,/g, ""));
                if (Number.isFinite(parsedSize)) {
                    const converted = Math.round(parsedSize * 10.7639 * 100) / 100;
                    cells[unitSizeIndex] = converted.toString();
                }
            }
            cells[unitSizeUnitIndex] = recognized ? (isSqM ? "SQ_FT" : unit) : (cells[unitSizeUnitIndex] ?? "");
        }

        while (cells.length < normalizedHeaders.length) cells.push("");
        const normalizedCells = cells.slice(0, normalizedHeaders.length);
        if (!hasRowChanges) {
            if (normalizedCells.length !== originalCells.length) {
                hasRowChanges = true;
            } else {
                hasRowChanges = normalizedCells.some((cell, index) => cell !== originalCells[index]);
            }
        }
        return normalizedCells.join(",");
    });

    if (!changed && !needsPad && !hasRowChanges) return file;

    const normalizedCsv = [normalizedHeaders.join(","), ...normalizedRows].join("\n");
    return new File([normalizedCsv], file.name, { type: file.type || "text/csv" });
};
