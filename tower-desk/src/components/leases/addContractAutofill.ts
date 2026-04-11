import type { BuildingUnit, Owner, PaymentFrequency } from "@/lib/types";

export type ContractUnitAutofillValues = {
    buildingNameSnapshot: string;
    propertyNumber: string;
    premisesNoDewa: string;
    propertySizeSqm: string;
    propertyTypeLabel: string;
    annualRent: string;
    securityDepositAmount: string;
    paymentFrequency: PaymentFrequency | "";
    ownerNameSnapshot: string;
    landlordNameSnapshot: string;
    landlordEmailSnapshot: string;
    landlordPhoneSnapshot: string;
};

export type ContractResidentSummaryValues = {
    tenantNameSnapshot?: string | null;
    tenantEmailSnapshot?: string | null;
    tenantPhoneSnapshot?: string | null;
    emiratesIdNumber?: string | null;
    passportNumber?: string | null;
    nationality?: string | null;
    dateOfBirth?: string | null;
    currentAddress?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
};

const paymentFrequencyLabel: Record<PaymentFrequency, string> = {
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
    SEMI_ANNUAL: "Semi-Annual",
    ANNUAL: "Annual",
};

type BuildContractUnitAutofillInput = {
    buildingName?: string;
    unit: BuildingUnit;
    owner?: Owner | null;
    unitTypeName?: string | null;
};

export const buildContractUnitAutofill = ({
    buildingName,
    unit,
    owner,
    unitTypeName,
}: BuildContractUnitAutofillInput): ContractUnitAutofillValues => {
    const nextAutoOwnerName = owner?.name?.trim() || "";

    return {
        buildingNameSnapshot: buildingName?.trim() || "",
        propertyNumber: (unit.label ?? "").trim(),
        premisesNoDewa: (unit.electricityMeterNumber ?? "").trim(),
        propertySizeSqm: unit.unitSize != null ? String(unit.unitSize) : "",
        propertyTypeLabel: unitTypeName?.trim() || "",
        annualRent: unit.rentAnnual != null ? String(unit.rentAnnual) : "",
        securityDepositAmount: unit.securityDepositAmount != null ? String(unit.securityDepositAmount) : "",
        paymentFrequency: unit.paymentFrequency ?? "",
        ownerNameSnapshot: nextAutoOwnerName,
        landlordNameSnapshot: nextAutoOwnerName,
        landlordEmailSnapshot: owner?.email?.trim() || "",
        landlordPhoneSnapshot: owner?.phone?.trim() || "",
    };
};

export const buildContractUnitSummaryFields = (autofill: ContractUnitAutofillValues) => {
    const frequencyLabel = autofill.paymentFrequency ? paymentFrequencyLabel[autofill.paymentFrequency] : "";

    return [
        { label: "Building Name", value: autofill.buildingNameSnapshot },
        { label: "Property Number", value: autofill.propertyNumber },
        { label: "Premises No Dewa", value: autofill.premisesNoDewa },
        { label: "Property Type Label", value: autofill.propertyTypeLabel },
        { label: "Property Size (sqm)", value: autofill.propertySizeSqm },
        { label: "Annual Rent", value: autofill.annualRent },
        { label: "Security Deposit", value: autofill.securityDepositAmount },
        { label: "Payment Frequency", value: frequencyLabel },
        { label: "Owner Name", value: autofill.ownerNameSnapshot },
    ].filter((field) => Boolean(field.value));
};

export const buildContractResidentSummaryFields = (resident: ContractResidentSummaryValues) =>
    [
        { label: "Tenant Name", value: resident.tenantNameSnapshot?.trim() || "" },
        { label: "Tenant Email", value: resident.tenantEmailSnapshot?.trim() || "" },
        { label: "Tenant Phone", value: resident.tenantPhoneSnapshot?.trim() || "" },
        { label: "Emirates ID Number", value: resident.emiratesIdNumber?.trim() || "" },
        { label: "Passport Number", value: resident.passportNumber?.trim() || "" },
        { label: "Nationality", value: resident.nationality?.trim() || "" },
        { label: "Date of Birth", value: resident.dateOfBirth?.trim() || "" },
        { label: "Current Address", value: resident.currentAddress?.trim() || "" },
        { label: "Emergency Contact Name", value: resident.emergencyContactName?.trim() || "" },
        { label: "Emergency Contact Phone", value: resident.emergencyContactPhone?.trim() || "" },
    ].filter((field) => Boolean(field.value));
