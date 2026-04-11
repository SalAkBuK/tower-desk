import { describe, expect, it } from "vitest";

import {
    buildContractResidentSummaryFields,
    buildContractUnitAutofill,
    buildContractUnitSummaryFields,
} from "../../src/components/leases/addContractAutofill";

describe("buildContractUnitAutofill", () => {
    it("maps unit size and unit type into the contract snapshot fields", () => {
        const autofill = buildContractUnitAutofill({
            buildingName: "Tower One",
            unit: {
                id: "unit-1",
                label: "101",
                unitSize: 875,
                unitSizeUnit: "SQ_FT",
                electricityMeterNumber: "DEWA-123",
                rentAnnual: 48000,
                paymentFrequency: "QUARTERLY",
                securityDepositAmount: 5000,
            },
            owner: {
                id: "owner-1",
                name: "Owner One",
                email: "owner@example.com",
                phone: "0500000000",
            },
            unitTypeName: "Apartment",
        });

        expect(autofill.buildingNameSnapshot).toBe("Tower One");
        expect(autofill.propertyNumber).toBe("101");
        expect(autofill.premisesNoDewa).toBe("DEWA-123");
        expect(autofill.propertySizeSqm).toBe("875");
        expect(autofill.propertyTypeLabel).toBe("Apartment");
        expect(autofill.annualRent).toBe("48000");
        expect(autofill.securityDepositAmount).toBe("5000");
        expect(autofill.paymentFrequency).toBe("QUARTERLY");
        expect(autofill.ownerNameSnapshot).toBe("Owner One");
        expect(autofill.landlordEmailSnapshot).toBe("owner@example.com");
    });

    it("builds unit summary preview fields from the same prefilled values", () => {
        const autofill = buildContractUnitAutofill({
            buildingName: "Tower One",
            unit: {
                id: "unit-1",
                label: "101",
                unitSize: 875,
                unitSizeUnit: "SQ_FT",
                electricityMeterNumber: "DEWA-123",
                rentAnnual: 48000,
                paymentFrequency: "QUARTERLY",
                securityDepositAmount: 5000,
            },
            owner: {
                id: "owner-1",
                name: "Owner One",
                email: "owner@example.com",
                phone: "0500000000",
            },
            unitTypeName: "Apartment",
        });

        expect(buildContractUnitSummaryFields(autofill)).toEqual([
            { label: "Building Name", value: "Tower One" },
            { label: "Property Number", value: "101" },
            { label: "Premises No Dewa", value: "DEWA-123" },
            { label: "Property Type Label", value: "Apartment" },
            { label: "Property Size (sqm)", value: "875" },
            { label: "Annual Rent", value: "48000" },
            { label: "Security Deposit", value: "5000" },
            { label: "Payment Frequency", value: "Quarterly" },
            { label: "Owner Name", value: "Owner One" },
        ]);
    });

    it("builds resident summary preview fields from the tenant snapshot values", () => {
        expect(buildContractResidentSummaryFields({
            tenantNameSnapshot: "Jane Doe",
            tenantEmailSnapshot: "jane@example.com",
            tenantPhoneSnapshot: "0501234567",
            emiratesIdNumber: "784-1987-1234567-1",
            passportNumber: "P1234567",
            nationality: "Pakistani",
            dateOfBirth: "1987-06-01",
            currentAddress: "Tower One, Unit 101",
            emergencyContactName: "John Doe",
            emergencyContactPhone: "0507654321",
        })).toEqual([
            { label: "Tenant Name", value: "Jane Doe" },
            { label: "Tenant Email", value: "jane@example.com" },
            { label: "Tenant Phone", value: "0501234567" },
            { label: "Emirates ID Number", value: "784-1987-1234567-1" },
            { label: "Passport Number", value: "P1234567" },
            { label: "Nationality", value: "Pakistani" },
            { label: "Date of Birth", value: "1987-06-01" },
            { label: "Current Address", value: "Tower One, Unit 101" },
            { label: "Emergency Contact Name", value: "John Doe" },
            { label: "Emergency Contact Phone", value: "0507654321" },
        ]);
    });
});
