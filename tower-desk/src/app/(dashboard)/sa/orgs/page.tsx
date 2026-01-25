"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, UserPlus, Building2 } from "lucide-react";
import { CreateOrgSheet, type CreatedOrg } from "@/components/orgs/CreateOrgSheet";
import { CreateOrgAdminSheet, type CreatedOrgAdmin } from "@/components/orgs/CreateOrgAdminSheet";
import { usePlatformOrgAdmins, usePlatformOrgs } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

export default function OrgsPage() {
    const { setSelectedOrgId: setActiveOrgId } = useAuth();
    const { data: orgs, isLoading, error } = usePlatformOrgs();
    const { data: orgAdmins, isLoading: isAdminsLoading, error: adminsError } = usePlatformOrgAdmins();
    const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
    const [lastAdmin, setLastAdmin] = useState<CreatedOrgAdmin | null>(null);
    const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
    const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);

    useEffect(() => {
        if (orgs) {
            console.log("[Platform] Orgs fetched:", orgs);
        }
    }, [orgs]);

    const adminsByOrg = useMemo(() => {
        const map = new Map<string, { id: string; email: string; name?: string }[]>();
        (orgAdmins || []).forEach((admin) => {
            const orgId = admin.orgId ? String(admin.orgId) : "unknown";
            const existing = map.get(orgId) ?? [];
            existing.push({ id: admin.id, email: admin.email, name: admin.name });
            map.set(orgId, existing);
        });
        return map;
    }, [orgAdmins]);

    const handleOrgCreated = (org: CreatedOrg) => {
        setSelectedOrgId(org.id);
        setActiveOrgId(org.id);
    };

    const handleAdminCreated = (admin: CreatedOrgAdmin) => {
        setLastAdmin(admin);
    };

    const handleOpenAdmin = (orgId?: string) => {
        setSelectedOrgId(orgId);
        setActiveOrgId(orgId ?? null);
        setIsCreateAdminOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Organizations</h1>
                    <p className="text-zinc-500 mt-1">Create orgs and provision their first admin.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button className="bg-zinc-900 text-white hover:bg-zinc-800" onClick={() => setIsCreateOrgOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Org
                    </Button>
                    <Button variant="outline" onClick={() => handleOpenAdmin(selectedOrgId)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create Org Admin
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Organizations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((item) => (
                                <Skeleton key={item} className="h-16 rounded-lg" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error instanceof Error ? error.message : "Failed to load organizations."}
                        </div>
                    ) : !orgs || orgs.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                            No orgs created yet. Use &quot;Create Org&quot; to start the flow.
                        </div>
                    ) : (
                        orgs.map((org) => (
                            <div
                                key={org.id}
                                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                                        <Building2 className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <div className="font-medium text-zinc-900">{org.name}</div>
                                        <div className="text-xs text-zinc-500">ID: {org.id}</div>
                                        {adminsError ? (
                                            <div className="text-xs text-rose-600 mt-1">Failed to load admins.</div>
                                        ) : isAdminsLoading ? (
                                            <div className="text-xs text-zinc-400 mt-1">Loading admins...</div>
                                        ) : (
                                            (() => {
                                                const admins = adminsByOrg.get(org.id) ?? [];
                                                if (admins.length === 0) {
                                                    return <div className="text-xs text-zinc-500 mt-1">No admins yet.</div>;
                                                }
                                                const preview = admins.slice(0, 2).map((admin) => admin.email).join(", ");
                                                const remainder = admins.length > 2 ? ` +${admins.length - 2}` : "";
                                                return (
                                                    <div className="text-xs text-zinc-500 mt-1">
                                                        Admins: {preview}{remainder}
                                                    </div>
                                                );
                                            })()
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {org.createdAt ? (
                                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                            {new Date(org.createdAt).toLocaleDateString()}
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {lastAdmin ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Last Org Admin Created</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-zinc-600">
                        <div>
                            <div className="text-zinc-900 font-medium">{lastAdmin.email}</div>
                            <div className="text-xs text-zinc-500">Org ID: {lastAdmin.orgId}</div>
                        </div>
                        {lastAdmin.tempPassword ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                <div className="text-xs uppercase tracking-wide text-emerald-700">Temporary Password</div>
                                <div className="font-mono text-emerald-800">{lastAdmin.tempPassword}</div>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                                No temporary password returned.
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : null}

            <CreateOrgSheet
                open={isCreateOrgOpen}
                onOpenChange={setIsCreateOrgOpen}
                onCreated={handleOrgCreated}
            />
            <CreateOrgAdminSheet
                open={isCreateAdminOpen}
                onOpenChange={setIsCreateAdminOpen}
                defaultOrgId={selectedOrgId}
                onCreated={handleAdminCreated}
            />
        </div>
    );
}
