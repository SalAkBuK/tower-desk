"use client";

import { useRequests } from "@/lib/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestStatus, ServiceRequest } from "@/lib/types"; // Import from types
import { useState } from "react";
import { RequestDetailSheet } from "@/components/requests/RequestDetailSheet";
import { RequestsGrid } from "@/components/requests/RequestsGrid";
import { RequestsTable } from "@/components/requests/RequestsTable";
import { RequestsViewToggle } from "@/components/requests/RequestsViewToggle";

export default function SuperadminRequestsPage() {
    const { data: requests, isLoading } = useRequests(); // Fetches ALL requests
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
    const [viewMode, setViewMode] = useState<"table" | "grid">("table");

    const filterRequests = (status: RequestStatus | 'all') => {
        if (!requests) return [];
        if (status === 'all') return requests;
        return requests.filter(r => r.status === status);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">All Service Requests</h1>
                    <p className="text-zinc-500 mt-1">Global view of maintenance across all buildings.</p>
                </div>
                <RequestsViewToggle value={viewMode} onChange={setViewMode} />
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList className="bg-zinc-100 p-1 rounded-lg">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Open</TabsTrigger>
                    <TabsTrigger value="assigned">Assigned</TabsTrigger>
                    <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                    <TabsTrigger value="cancelled">Canceled</TabsTrigger>
                </TabsList>

                {['all', 'pending', 'assigned', 'in-progress', 'completed', 'cancelled'].map((tab) => {
                    const filteredRequests = filterRequests(tab as RequestStatus | 'all');
                    return (
                        <TabsContent key={tab} value={tab} className="mt-6 space-y-4">
                            {viewMode === "table" ? (
                                <RequestsTable
                                    requests={filteredRequests}
                                    isLoading={isLoading}
                                    onSelect={setSelectedRequest}
                                />
                            ) : (
                                <RequestsGrid
                                    requests={filteredRequests}
                                    isLoading={isLoading}
                                    onSelect={setSelectedRequest}
                                />
                            )}
                        </TabsContent>
                    );
                })}
            </Tabs>

            <RequestDetailSheet
                requestId={selectedRequest?.id ?? null}
                buildingId={selectedRequest?.buildingId ?? null}
                buildingNameById={undefined}
                onClose={() => setSelectedRequest(null)}
            />
        </div>
    );
}
