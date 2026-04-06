"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Plus, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import {
    useAccessibleBuildings,
    useAdminUsers,
    useCreateUserAccessAssignment,
    useDeleteUserAccessAssignment,
    useEffectivePermissions,
    useRoleTemplates,
    useSetUserPermissionOverrides,
    useUserAccessAssignments,
    useUserPermissionOverrides,
} from "@/lib/queries";
import { hasPermission as hasRbacPermission } from "@/lib/rbac";
import type { RoleDefinition } from "@/lib/types";
import { getUserAccessView } from "@/lib/userAccess";

const NO_PRIMARY_ORG_ACCESS = "__none__";

type RoleTemplateOption = { id: string; key: string; name: string; disabled?: boolean };

function PrimaryOrgAccessSection({
    currentRoleId,
    currentRoleName,
    roleOptions,
    isSaving,
    onSave,
}: {
    currentRoleId: string;
    currentRoleName?: string;
    roleOptions: RoleTemplateOption[];
    isSaving: boolean;
    onSave: (roleId: string) => void;
}) {
    const [draftRoleId, setDraftRoleId] = useState(currentRoleId || NO_PRIMARY_ORG_ACCESS);
    const canSave = !isSaving && draftRoleId !== currentRoleId;
    return (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Org Access</h3>
                    <p className="mt-1 text-sm text-zinc-500">Read templates from `/role-templates`, then write org assignments via `/users/:userId/access-assignments`.</p>
                </div>
                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">{currentRoleName ?? "None"}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <Select value={draftRoleId || NO_PRIMARY_ORG_ACCESS} onValueChange={setDraftRoleId}>
                    <SelectTrigger><SelectValue placeholder="No org assignment" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_PRIMARY_ORG_ACCESS}>None</SelectItem>
                        {roleOptions.map((roleEntry) => (
                            <SelectItem key={roleEntry.id} value={roleEntry.id} disabled={roleEntry.disabled}>
                                {roleEntry.name} ({roleEntry.key})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button type="button" onClick={() => onSave(draftRoleId)} disabled={!canSave}>{isSaving ? "Saving..." : "Save"}</Button>
            </div>
        </div>
    );
}

export default function AdminUserAccessPage() {
    const { user, baseRole } = useAuth();
    const searchParams = useSearchParams();
    const canManageAccess = baseRole === "superadmin" || hasRbacPermission(user, "users.write");
    const buildingsQuery = useAccessibleBuildings(user?.id, baseRole);
    const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
    const buildingNameById = useMemo(() => buildings.reduce<Record<string, string>>((acc, building) => {
        acc[building.id] = building.name;
        return acc;
    }, {}), [buildings]);
    const { data: users, isLoading } = useAdminUsers(buildings.map((building) => building.id));
    const [search, setSearch] = useState("");
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [newBuildingRoleId, setNewBuildingRoleId] = useState("");
    const [newBuildingId, setNewBuildingId] = useState("");
    const requestedUserId = searchParams.get("userId");
    const visibleUsers = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (users ?? [])
            .filter((entry) => (entry.baseRole ?? entry.role) !== "superadmin")
            .filter((entry) => !term || `${entry.name} ${entry.email}`.toLowerCase().includes(term));
    }, [search, users]);
    const activeSelectedUserId = useMemo(() => {
        if (requestedUserId && visibleUsers.some((entry) => entry.id === requestedUserId)) return requestedUserId;
        if (selectedUserId && visibleUsers.some((entry) => entry.id === selectedUserId)) return selectedUserId;
        return visibleUsers[0]?.id ?? null;
    }, [requestedUserId, selectedUserId, visibleUsers]);
    const selectedUser = useMemo(() => visibleUsers.find((entry) => entry.id === activeSelectedUserId) ?? null, [activeSelectedUserId, visibleUsers]);
    const { data: roleTemplates } = useRoleTemplates({ enabled: canManageAccess && Boolean(selectedUser) });
    const { data: accessAssignmentsData } = useUserAccessAssignments(selectedUser?.id, { enabled: Boolean(selectedUser) });
    const { data: overrideData } = useUserPermissionOverrides(selectedUser?.id, { enabled: Boolean(selectedUser) });
    const { data: effectivePermissionsData } = useEffectivePermissions(selectedUser ? [selectedUser.id] : [], { enabled: Boolean(selectedUser) });
    const setUserPermissionOverrides = useSetUserPermissionOverrides();
    const createUserAccessAssignment = useCreateUserAccessAssignment();
    const deleteUserAccessAssignment = useDeleteUserAccessAssignment();
    const roleTemplateMap = useMemo(() => (roleTemplates ?? []).reduce<Record<string, RoleDefinition>>((acc, roleTemplate) => {
        acc[roleTemplate.id] = roleTemplate;
        return acc;
    }, {}), [roleTemplates]);
    const hydratedAssignments = useMemo(() => (accessAssignmentsData ?? []).map((assignment) => {
        const roleTemplate = assignment.roleId ? roleTemplateMap[assignment.roleId] : undefined;
        return {
            ...assignment,
            roleTemplateName: roleTemplate?.name ?? assignment.roleTemplateKey,
            buildingName: assignment.scopeId ? buildingNameById[assignment.scopeId] : undefined,
        };
    }), [accessAssignmentsData, buildingNameById, roleTemplateMap]);
    const orgAssignments = useMemo(() => hydratedAssignments.filter((assignment) => assignment.scopeType === "ORG"), [hydratedAssignments]);
    const buildingAssignments = useMemo(() => hydratedAssignments.filter((assignment) => assignment.scopeType === "BUILDING"), [hydratedAssignments]);
    const access = useMemo(() => {
        if (!selectedUser) return getUserAccessView(null);
        return getUserAccessView({
            ...selectedUser,
            orgAccess: orgAssignments.length > 0 ? orgAssignments : selectedUser.orgAccess,
            buildingAccess: buildingAssignments.length > 0 ? buildingAssignments : selectedUser.buildingAccess,
        });
    }, [buildingAssignments, orgAssignments, selectedUser]);
    const orgRoleOptions = useMemo(() => {
        const options = (roleTemplates ?? [])
            .filter((roleTemplate) => !roleTemplate.scopeType || roleTemplate.scopeType === "ORG")
            .map((roleTemplate) => ({ id: roleTemplate.id, key: roleTemplate.key, name: roleTemplate.name }));
        const current = orgAssignments[0];
        if (!current?.roleId || options.some((option) => option.id === current.roleId)) return options;
        return [{ id: current.roleId, key: current.roleTemplateKey, name: current.roleTemplateName ?? current.roleTemplateKey, disabled: true }, ...options];
    }, [orgAssignments, roleTemplates]);
    const buildingRoleOptions = useMemo(() => (roleTemplates ?? [])
        .filter((roleTemplate) => roleTemplate.scopeType === "BUILDING")
        .map((roleTemplate) => ({ id: roleTemplate.id, key: roleTemplate.key, name: roleTemplate.name })), [roleTemplates]);
    const currentOverrides = overrideData ?? access.permissionOverrides ?? [];
    const effectivePermissions = useMemo(() => {
        if (access.effectivePermissions.length > 0) return access.effectivePermissions;
        const match = effectivePermissionsData?.find((entry) => String(entry.userId) === String(selectedUser?.id));
        return match?.permissions ?? [];
    }, [access.effectivePermissions, effectivePermissionsData, selectedUser?.id]);
    const savePrimaryOrgAccess = async (roleId: string) => {
        if (!selectedUser) return;
        try {
            await Promise.all(orgAssignments.map((assignment) => assignment.assignmentId).filter(Boolean).map((assignmentId) =>
                deleteUserAccessAssignment.mutateAsync({ userId: selectedUser.id, assignmentId: assignmentId as string })
            ));
            if (roleId && roleId !== NO_PRIMARY_ORG_ACCESS) {
                await createUserAccessAssignment.mutateAsync({ userId: selectedUser.id, payload: { roleTemplateId: roleId, scopeType: "ORG", scopeId: null } });
            }
            toast.success("Org access updated");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update org access");
        }
    };
    const handleAddBuildingAccess = async () => {
        if (!selectedUser || !newBuildingRoleId || !newBuildingId) return toast.error("Select both a building and a building role template.");
        if (buildingAssignments.some((assignment) => assignment.roleId === newBuildingRoleId && assignment.scopeId === newBuildingId)) {
            return toast.error("This building assignment already exists.");
        }
        try {
            await createUserAccessAssignment.mutateAsync({ userId: selectedUser.id, payload: { roleTemplateId: newBuildingRoleId, scopeType: "BUILDING", scopeId: newBuildingId } });
            toast.success("Building access added");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to add building access");
        }
    };
    const handleRemoveAssignment = async (assignmentId?: string, label = "access") => {
        if (!selectedUser || !assignmentId) return;
        try {
            await deleteUserAccessAssignment.mutateAsync({ userId: selectedUser.id, assignmentId });
            toast.success(`${label} removed`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Failed to remove ${label.toLowerCase()}`);
        }
    };
    const clearOverrides = () => {
        if (!selectedUser) return;
        setUserPermissionOverrides.mutate({ userId: selectedUser.id, overrides: [] }, {
            onSuccess: () => toast.success("Permission overrides cleared"),
            onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to clear overrides"),
        });
    };
    if (!canManageAccess) {
        return <div className="rounded-2xl border border-zinc-200 bg-white p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500"><ShieldCheck className="h-5 w-5" /></div><div><h1 className="text-lg font-semibold text-zinc-900">User Access</h1><p className="text-sm text-zinc-500">You do not have access to manage user permissions.</p></div></div></div>;
    }
    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">User Access</h1>
                        <p className="mt-1 text-sm text-zinc-500">Manage org-scoped and building-scoped assignments from role templates and user access assignments.</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2"><KeyRound className="h-4 w-4 text-zinc-500" /><span className="text-xs uppercase tracking-wide text-zinc-400">RBAC v2</span></div>
                </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"><Search className="h-4 w-4 text-zinc-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." className="w-full bg-transparent text-sm text-zinc-700 outline-none" /></div>
                    <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                        {isLoading ? <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500">Loading users...</div> : visibleUsers.length === 0 ? <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500">No users match this search.</div> : visibleUsers.map((entry) => {
                            const entryAccess = getUserAccessView(entry);
                            const active = entry.id === activeSelectedUserId;
                            return <button key={entry.id} type="button" onClick={() => setSelectedUserId(entry.id)} className={`w-full rounded-xl border px-3 py-3 text-left transition ${active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"}`}><p className={`text-sm font-semibold ${active ? "text-white" : "text-zinc-900"}`}>{entry.name}</p><p className={`text-xs ${active ? "text-zinc-200" : "text-zinc-500"}`}>{entry.email}</p><div className="mt-2 flex flex-wrap gap-1">{entryAccess.primaryOrgAccess?.roleName ? <Badge variant="secondary" className={active ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-700"}>{entryAccess.primaryOrgAccess.roleName}</Badge> : null}{entryAccess.buildingAccess.slice(0, 2).map((assignment) => <Badge key={`${assignment.assignmentId ?? assignment.roleTemplateKey}-${assignment.scopeId ?? "org"}`} variant="secondary" className={active ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-700"}>{assignment.roleTemplateKey}</Badge>)}</div></button>;
                        })}
                    </div>
                </div>
                <div className="space-y-4">
                    {!selectedUser ? <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">Select a user to inspect access.</div> : <>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-zinc-900">{selectedUser.name}</h2>
                                    <p className="mt-1 text-sm text-zinc-500">{selectedUser.email}</p>
                                    <p className="mt-2 text-xs uppercase tracking-wide text-zinc-400">{access.displayLabel ?? access.primaryOrgAccess?.roleName ?? "No display label"}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {access.orgAccess.map((assignment) => <Badge key={`${assignment.assignmentId ?? assignment.roleTemplateKey}-org`} variant="secondary" className="bg-zinc-100 text-zinc-700">{assignment.roleTemplateKey}</Badge>)}
                                    {access.buildingAccess.map((assignment) => <Badge key={`${assignment.assignmentId ?? assignment.roleTemplateKey}-${assignment.scopeId ?? ""}`} variant="secondary" className="bg-zinc-100 text-zinc-700">{[assignment.roleTemplateKey, assignment.buildingName ?? assignment.scopeId].filter(Boolean).join(" / ")}</Badge>)}
                                    {access.resident ? <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">Resident</Badge> : null}
                                </div>
                            </div>
                        </div>
                        <PrimaryOrgAccessSection
                            key={selectedUser.id}
                            currentRoleId={orgAssignments[0]?.roleId ?? NO_PRIMARY_ORG_ACCESS}
                            currentRoleName={access.primaryOrgAccess?.roleName}
                            roleOptions={orgRoleOptions}
                            isSaving={createUserAccessAssignment.isPending || deleteUserAccessAssignment.isPending}
                            onSave={savePrimaryOrgAccess}
                        />
                        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-900">Building Access</h3>
                                    <p className="mt-1 text-sm text-zinc-500">Assignments render from `buildingAccess` and mutations use `/users/:userId/access-assignments`.</p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-[220px_220px_auto]">
                                    <Select value={newBuildingRoleId} onValueChange={setNewBuildingRoleId}>
                                        <SelectTrigger><SelectValue placeholder="Role template" /></SelectTrigger>
                                        <SelectContent>{buildingRoleOptions.map((roleTemplate) => <SelectItem key={roleTemplate.id} value={roleTemplate.id}>{roleTemplate.name} ({roleTemplate.key})</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Select value={newBuildingId} onValueChange={setNewBuildingId}>
                                        <SelectTrigger><SelectValue placeholder="Building" /></SelectTrigger>
                                        <SelectContent>{buildings.map((building) => <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button type="button" onClick={handleAddBuildingAccess} disabled={createUserAccessAssignment.isPending}><Plus className="mr-2 h-4 w-4" />Add</Button>
                                </div>
                            </div>
                            {buildingAssignments.length > 0 ? <div className="space-y-2">{buildingAssignments.map((assignment) => <div key={assignment.assignmentId ?? `${assignment.roleTemplateKey}:${assignment.scopeId ?? ""}`} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"><div>{[assignment.roleTemplateKey, assignment.buildingName ?? assignment.scopeId].filter(Boolean).join(" / ")}</div>{assignment.assignmentId ? <Button type="button" variant="outline" size="sm" disabled={deleteUserAccessAssignment.isPending} onClick={() => handleRemoveAssignment(assignment.assignmentId, "Building access")}>Remove</Button> : <Badge variant="secondary" className="bg-zinc-200 text-zinc-700">Missing assignment id</Badge>}</div>)}</div> : <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">No Building Access.</div>}
                        </div>
                        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
                            <h3 className="text-sm font-semibold text-zinc-900">Resident Access</h3>
                            <p className="text-sm text-zinc-500">Manage occupancy linkage through resident endpoints and resident workflows.</p>
                            {access.resident ? <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{[access.resident.buildingName ?? buildingNameById[access.resident.buildingId ?? ""] ?? access.resident.buildingId, access.resident.unitLabel ?? access.resident.unitId, access.resident.status].filter(Boolean).join(" / ")}</div> : <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">No Resident Access.</div>}
                        </div>
                        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-900">Permission overrides</h3>
                                    <p className="mt-1 text-sm text-zinc-500">Explicit allow and deny rules are listed separately from access assignments.</p>
                                </div>
                                {currentOverrides.length > 0 ? <Button type="button" variant="outline" onClick={clearOverrides}>Clear overrides</Button> : null}
                            </div>
                            {currentOverrides.length > 0 ? <div className="flex flex-wrap gap-2">{currentOverrides.map((override) => <Badge key={`${override.permissionKey}-${override.effect}`} variant="secondary" className="bg-zinc-100 text-zinc-700">{override.permissionKey} / {override.effect}</Badge>)}</div> : <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">No permission overrides.</div>}
                        </div>
                        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
                            <h3 className="text-sm font-semibold text-zinc-900">Effective permissions</h3>
                            <p className="text-sm text-zinc-500">Read-only support and debugging view.</p>
                            {effectivePermissions.length > 0 ? <div className="flex flex-wrap gap-2">{effectivePermissions.map((permission) => <Badge key={permission} variant="secondary" className="bg-zinc-100 text-zinc-700">{permission}</Badge>)}</div> : <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">No effective permissions returned.</div>}
                        </div>
                    </>}
                </div>
            </div>
        </div>
    );
}
