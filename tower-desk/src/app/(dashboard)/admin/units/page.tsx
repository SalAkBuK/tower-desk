"use client";

import { UnitsPage } from "@/components/units/UnitsPage";

export default function AdminUnitsPage() {
    return (
        <UnitsPage
            title="Units"
            subtitle="Manage residential and commercial units."
            directoryTitle="Unit Directory"
            directoryDescription="View and manage units in the selected building."
        />
    );
}
