"use client";

import { useParams } from "next/navigation";
import { BuildingDetails } from "@/components/buildings/BuildingDetails";

export default function BuildingDetailsPage() {
    const params = useParams();
    const buildingId = params.buildingId as string;

    // Using the unified BuildingDetails component with consistent back link and no tenant shortcuts
    return <BuildingDetails buildingId={buildingId} backHref="/platform/buildings" showAddTenant={false} />;
}
