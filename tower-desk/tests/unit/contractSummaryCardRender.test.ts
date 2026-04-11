import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContractSummaryCard } from "../../src/components/leases/ContractModalPrimitives";

describe("ContractSummaryCard render", () => {
    it("renders field previews as labeled form-style values", () => {
        const markup = renderToStaticMarkup(createElement(ContractSummaryCard, {
            label: "Unit summary",
            title: "Unit 101",
            fields: [
                { label: "Property Size (sqm)", value: "875" },
                { label: "Annual Rent", value: "48000" },
            ],
            tone: "accent",
        }));

        expect(markup).toContain("Property Size (sqm)");
        expect(markup).toContain("875");
        expect(markup).toContain("Annual Rent");
        expect(markup).toContain("48000");
    });
});
