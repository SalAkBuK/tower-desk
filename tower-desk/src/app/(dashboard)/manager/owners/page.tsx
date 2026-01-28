import { redirect } from "next/navigation";

export default function ManagerOwnersPage() {
    redirect("/manager/residents");
}

/*
"use client";

import { ResidentsPage } from "@/components/residents/ResidentsPage";
// import AdminOwnersPage from "@/app/(dashboard)/admin/owners/page";

export default function ManagerOwnersPage() {
    return <ResidentsPage title="Owners" />;
    // return <AdminOwnersPage />;
}
*/
