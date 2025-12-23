"use client";

import { useRequests } from "@/lib/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequestPriority, RequestStatus } from "@/lib/types"; // Import from types
import { useState } from "react";
import { RequestDetailSheet } from "@/components/requests/RequestDetailSheet";
import { ClipboardList, Clock, AlertCircle, CheckCircle2, Building2 } from "lucide-react";

export default function SuperadminRequestsPage() {
    const { data: requests, isLoading } = useRequests(); // Fetches ALL requests
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

    const filterRequests = (status: RequestStatus | 'all') => {
        if (!requests) return [];
        if (status === 'all') return requests;
        return requests.filter(r => r.status === status);
    };

    const getStatusIcon = (status: RequestStatus) => {
        switch (status) {
            case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
            case 'assigned': return <ClipboardList className="w-4 h-4 text-purple-500" />;
            case 'in-progress': return <AlertCircle className="w-4 h-4 text-blue-500" />;
            case 'on-hold': return <AlertCircle className="w-4 h-4 text-gray-500" />;
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'cancelled': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default: return <ClipboardList className="w-4 h-4 text-zinc-400" />;
        }
    };
    const priorityStyles: Record<RequestPriority, string> = {
        low: "bg-emerald-50 text-emerald-700 border-emerald-200",
        medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
        high: "bg-orange-50 text-orange-700 border-orange-200",
        urgent: "bg-red-50 text-red-700 border-red-200"
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">All Service Requests</h1>
                    <p className="text-zinc-500 mt-1">Global view of maintenance across all buildings.</p>
                </div>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList className="bg-zinc-100 p-1 rounded-lg">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                    <TabsTrigger value="assigned">Assigned</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>

                {['all', 'pending', 'in-progress', 'assigned', 'completed'].map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-6 space-y-4">
                        {isLoading ? (
                            <div className="text-zinc-500">Loading requests...</div>
                        ) : filterRequests(tab as RequestStatus | 'all').length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-zinc-200">
                                <p className="text-zinc-500">No requests found.</p>
                            </div>
                        ) : (
                            filterRequests(tab as RequestStatus | 'all').map((req) => (
                                <Card
                                    key={req.id}
                                    className="cursor-pointer hover:shadow-md transition-shadow group border-zinc-200"
                                    onClick={() => setSelectedRequestId(req.id)}
                                >
                                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                                        <div className="space-y-1">
                                            <CardTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                                                {req.title}
                                                <Badge variant="outline" className={`text-[10px] h-5 px-1.5 capitalize ${priorityStyles[req.priority]}`}>
                                                    {req.priority}
                                                </Badge>
                                            </CardTitle>
                                            <p className="text-sm text-zinc-500 line-clamp-1">{req.description}</p>
                                        </div>
                                        <Badge variant="outline" className="flex items-center gap-1">
                                            {getStatusIcon(req.status)}
                                            <span className="capitalize">{req.status}</span>
                                        </Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-xs text-zinc-400 flex items-center gap-4">
                                            <span>ID: {req.id}</span>
                                            <span className="flex items-center gap-1">
                                                <Building2 className="w-3 h-3" />
                                                {req.buildingId}
                                            </span>
                                            <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>
                ))}
            </Tabs>

            <RequestDetailSheet
                requestId={selectedRequestId}
                onClose={() => setSelectedRequestId(null)}
            />
        </div>
    );
}
