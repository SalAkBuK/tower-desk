"use client";

import { useParams } from "next/navigation";
import { BuildingDetails } from "@/components/buildings/BuildingDetails";

export default function AdminBuildingDetailsPage() {
    const params = useParams();
    const buildingId = params.buildingId as string;
    return <BuildingDetails buildingId={buildingId} backHref="/admin/buildings" />;
}
