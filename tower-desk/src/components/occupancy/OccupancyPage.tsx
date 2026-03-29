"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Home, LayoutGrid, List, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import {
    useAdminBuildings,
    useManagerBuildings,
    useBuildingOccupanciesDto,
} from "@/lib/queries";

type StatusFilter = "ALL" | "ACTIVE" | "ENDED";
type DateRangeKey = "all" | "last30" | "last90" | "custom";
type SortKey = "startDesc" | "endDesc" | "unitAsc";

export function OccupancyPage({ title = "Occupancy" }: { title?: string }) {
    const { user, baseRole } = useAuth();
    const isManager = baseRole === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : user?.id);
    const managerBuildingsQuery = useManagerBuildings(isManager ? user?.id : undefined);
    const buildings = isManager ? managerBuildingsQuery.data : adminBuildingsQuery.data;

    const [selectedBuildingId, setSelectedBuildingId] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [dateRange, setDateRange] = useState<DateRangeKey>("all");
    const [customStartDate, setCustomStartDate] = useState<string>("");
    const [customEndDate, setCustomEndDate] = useState<string>("");
    const [sortBy, setSortBy] = useState<SortKey>("startDesc");
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");

    const buildingOptions = useMemo(
        () => (buildings || []).map((building) => ({ id: building.id, name: building.name })),
        [buildings]
    );

    useEffect(() => {
        if (selectedBuildingId || buildingOptions.length === 0) return;
        setSelectedBuildingId(buildingOptions[0].id);
    }, [buildingOptions, selectedBuildingId]);

    // single call: occupancy DTOs
    const { data: occupanciesDto, isLoading } = useBuildingOccupanciesDto(
        selectedBuildingId,
        statusFilter,
        {
            enabled: Boolean(selectedBuildingId),
        }
    );

    // normalize DTOs into the existing BuildingOccupancy shape your UI expects
    const normalizedOccupancies = useMemo(() => {
        return (occupanciesDto || []).map((o) => ({
            id: o.id,
            unitId: o.unitId,
            unitLabel: o.unit?.label ?? "",
            residentUserId: o.residentUserId,
            residentName: o.resident?.name ?? "",
            residentEmail: o.resident?.email ?? "",
            status: o.status,
            startAt: o.startAt,
            endAt: o.endAt ?? undefined,
            unit: o.unit,
            resident: o.resident,
        }));
    }, [occupanciesDto]);

    const occupancyMeta = useMemo(() => {
        const byResident = new Map<string, { count: number; hasActive: boolean; hasEnded: boolean }>();
        const byUnit = new Map<string, number>();

        normalizedOccupancies.forEach((entry) => {
            const residentId = entry.residentUserId || entry.resident?.id;
            if (residentId) {
                const meta = byResident.get(residentId) ?? { count: 0, hasActive: false, hasEnded: false };
                meta.count += 1;
                if (entry.status === "ACTIVE") meta.hasActive = true;
                if (entry.status === "ENDED") meta.hasEnded = true;
                byResident.set(residentId, meta);
            }

            if (entry.unitId) {
                byUnit.set(entry.unitId, (byUnit.get(entry.unitId) ?? 0) + 1);
            }
        });

        return { byResident, byUnit };
    }, [normalizedOccupancies]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const now = new Date();
        const daysAgo = (days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);

        let rangeStart: Date | null = null;
        let rangeEnd: Date | null = null;

        if (dateRange === "last30") {
            rangeStart = daysAgo(30);
            rangeEnd = now;
        } else if (dateRange === "last90") {
            rangeStart = daysAgo(90);
            rangeEnd = now;
        } else if (dateRange === "custom") {
            rangeStart = customStartDate ? new Date(customStartDate) : null;
            rangeEnd = customEndDate ? new Date(customEndDate) : null;
        }

        if (rangeStart) {
            rangeStart = new Date(
                rangeStart.getFullYear(),
                rangeStart.getMonth(),
                rangeStart.getDate(),
                0,
                0,
                0,
                0
            );
        }

        if (rangeEnd) {
            rangeEnd = new Date(
                rangeEnd.getFullYear(),
                rangeEnd.getMonth(),
                rangeEnd.getDate(),
                23,
                59,
                59,
                999
            );
        }

        return normalizedOccupancies.filter((entry) => {
            const normalizedStatus = String(entry.status ?? "").toUpperCase();
            if (statusFilter !== "ALL" && normalizedStatus !== statusFilter) return false;

            if (term) {
                const haystack = `${entry.unitLabel ?? ""} ${entry.residentName ?? ""} ${entry.residentEmail ?? ""}`.toLowerCase();
                if (!haystack.includes(term)) return false;
            }

            if (rangeStart || rangeEnd) {
                const start = entry.startAt ? new Date(entry.startAt) : null;
                const end = entry.endAt ? new Date(entry.endAt) : null;
                const effectiveEnd = end ?? now;

                if (start && rangeEnd && start > rangeEnd) return false;
                if (rangeStart && effectiveEnd < rangeStart) return false;
            }

            return true;
        });
    }, [normalizedOccupancies, search, statusFilter, dateRange, customStartDate, customEndDate]);

    
    const sorted = useMemo(() => {
        const next = [...filtered];

        if (sortBy === "startDesc") {
            next.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
        } else if (sortBy === "endDesc") {
            next.sort((a, b) => {
                const aEnd = a.endAt ? new Date(a.endAt).getTime() : -Infinity;
                const bEnd = b.endAt ? new Date(b.endAt).getTime() : -Infinity;
                return bEnd - aEnd;
            });
        } else if (sortBy === "unitAsc") {
            next.sort((a, b) => (a.unitLabel ?? "").localeCompare(b.unitLabel ?? ""));
        }

        return next;
    }, [filtered, sortBy]);

    // optional: use this in your stats card instead of residents?.length
    const residentsCount = useMemo(() => {
        const ids = new Set<string>();
        normalizedOccupancies.forEach((o) => {
            const id = o.residentUserId || o.resident?.id;
            if (id) ids.add(id);
        });
        return ids.size;
    }, [normalizedOccupancies]);


    return (
        <div className="space-y-6">
  <div className="rounded-2xl border border-zinc-200 bg-white p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">Monitor active unit occupancy across buildings.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Select building" />
          </SelectTrigger>
          <SelectContent>
            {buildingOptions.map((building) => (
              <SelectItem key={building.id} value={building.id}>
                {building.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Home className="h-5 w-5" />
        </div>
        <div className="mt-3 text-2xl font-bold text-zinc-900">{sorted.length}</div>
        <p className="text-xs text-zinc-500">Occupancies</p>
      </div>

      {/* Residents count now derived from occupancies (no /residents call) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <Users className="h-5 w-5" />
        </div>
        <div className="mt-3 text-2xl font-bold text-zinc-900">{residentsCount}</div>
        <p className="text-xs text-zinc-500">Residents</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="mt-3 text-2xl font-bold text-zinc-900">{buildingOptions.length}</div>
        <p className="text-xs text-zinc-500">Buildings</p>
      </div>
    </div>
  </div>

  <Card className="border-zinc-200">
    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <CardTitle>Occupancy Ledger</CardTitle>
        <p className="text-sm text-zinc-500">Active resident-to-unit assignments.</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search units or residents"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRangeKey)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="last30">Last 30 days</SelectItem>
            <SelectItem value="last90">Last 90 days</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="startDesc">Newest start</SelectItem>
            <SelectItem value="endDesc">Newest end</SelectItem>
            <SelectItem value="unitAsc">Unit A-Z</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 bg-zinc-100/50 p-1 rounded-lg border border-zinc-200/50">
          <Button
            variant={viewMode === "list" ? "white" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className={viewMode === "list" ? "bg-white shadow-sm" : ""}
          >
            <List className="mr-2 h-4 w-4" />
            List
          </Button>
          <Button
            variant={viewMode === "grid" ? "white" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className={viewMode === "grid" ? "bg-white shadow-sm" : ""}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            Grid
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent className="space-y-4">
      {dateRange === "custom" && (
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:w-52">
            <Input
              type="date"
              value={customStartDate}
              onChange={(event) => setCustomStartDate(event.target.value)}
              placeholder="Start date"
            />
          </div>
          <div className="w-full sm:w-52">
            <Input
              type="date"
              value={customEndDate}
              onChange={(event) => setCustomEndDate(event.target.value)}
              placeholder="End date"
            />
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="rounded-xl border border-zinc-200 bg-white p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          ))}
        </div>
      ) : !selectedBuildingId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
          Select a building to view occupancy.
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
          No occupancy records.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((entry) => {
            const residentKey = entry.residentUserId || entry.resident?.id || "";
            const residentMeta = residentKey ? occupancyMeta.byResident.get(residentKey) : undefined;
            const isReturning = Boolean(
              residentMeta && (residentMeta.count > 1 || (residentMeta.hasActive && residentMeta.hasEnded))
            );
            const historyCount = residentMeta?.count ?? 0;
            const unitCount = occupancyMeta.byUnit.get(entry.unitId) ?? 0;
            const isHighTurnover = unitCount >= 3;

            return (
            <div key={entry.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{entry.unitLabel || "Unit"}</div>
                  <div className="text-xs text-zinc-500">{entry.residentName || "Unknown resident"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                    {entry.status || "ACTIVE"}
                  </Badge>
                  {isReturning && (
                    <>
                      <Badge className="bg-amber-100 text-amber-800">Returning</Badge>
                      <Badge variant="outline">History ({historyCount})</Badge>
                    </>
                  )}
                  {isHighTurnover && (
                    <Badge className="bg-rose-100 text-rose-800">High turnover</Badge>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs text-zinc-500">
                <div className="flex items-center justify-between">
                  <span>Resident Email</span>
                  <span className="font-medium text-zinc-700">{entry.residentEmail || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Move-In</span>
                  <span className="font-medium text-zinc-700">
                    {entry.startAt ? new Date(entry.startAt).toLocaleDateString() : "-"}
                  </span>
                </div>
                {entry.endAt && (
                  <div className="flex items-center justify-between">
                    <span>End</span>
                    <span className="font-medium text-zinc-700">
                      {entry.endAt ? new Date(entry.endAt).toLocaleDateString() : "-"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Unit</TableHead>
                <TableHead>Resident</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Move-In</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm font-medium text-zinc-900">
                    {entry.unitLabel || "Unit"}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-700">
                    {entry.residentName || "Unknown resident"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                      {entry.status || "ACTIVE"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-600">
                    {entry.startAt ? new Date(entry.startAt).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className="text-zinc-600">
                    {entry.endAt ? new Date(entry.endAt).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className="text-zinc-600">{entry.residentEmail || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
</div>

    );
}
