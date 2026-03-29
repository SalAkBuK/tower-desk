 Plan: Refactor CreateUnitSheet Parking Logic

 Goal

 Replace the broken N+1 query parking logic in CreateUnitSheet with a clean flow:
 fetch vacant slots via useParkingSlots(buildingId, { available: true }), let user select, allocate to unit on submit. Show allocated slots on unit detail sheet.

 Files to Modify
 ┌─────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────┐
 │                          File                           │                               Change                               │
 ├─────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
 │ tower-desk/src/components/buildings/CreateUnitSheet.tsx │ Major refactor — remove N+1 queries, simplify parking UI, fix bugs │
 ├─────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
 │ tower-desk/src/components/buildings/UnitDetailSheet.tsx │ Add parking allocations section                                    │
 └─────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────┘
 No changes needed in queries.ts, api.ts, or UnitsPage.tsx — existing hooks already support the new flow.

 ---
 Step 1: CreateUnitSheet — Remove dead imports

 Remove from imports:
 - useBuildingOccupancies, useUpdateParkingSlot (from @/lib/queries)
 - useQueries (from @tanstack/react-query)
 - CreateParkingSlotSheet import (line 23)
 - getOccupancyParkingAllocations, getOccupancyVehicles, getUnitParkingAllocations (from `@/lib/api/parking`)

 Step 2: CreateUnitSheet — Remove dead state/hooks

 Remove these declarations:
 - updateParkingSlot hook (line 162)
 - occupancies query (line 172)
 - editParkingSlot state (line 189)
 - shouldFetchSlots and existingSlots all-slots query (lines 190-191)

 Step 3: CreateUnitSheet — Replace N+1 parking logic (lines 319-537)

 Delete all of these (~220 lines):
 - unitLabelForSlots, existingSlotPrefix, unitSlots (prefix matching)
 - activeUnitOccupancies, activeBuildingOccupancies, activeOccupancyUnitIds, unitsWithoutActiveOccupancy
 - buildingOccupancyIds, buildingAllocationQueries (useQueries N+1)
 - unitAllocationQueries (useQueries N+1)
 - occupiedSlotIds computation
 - vacantSlots, selectedVacantSlots (old computed versions)
 - occupancyIds, allocationQueries (useQueries N+1)
 - allocatedSlots, isUnitSlotsLoading, isVacantSlotsLoading, vacantSlotsError
 - occupancyById, vehicleQueries (useQueries N+1), vehicles, isVehiclesLoading
 - allocationSlotEntries, currentUnitAllocationSlots, unitSlotEntries
 - handleToggleSlotActive function (lines 540-551)

 Replace with (~30 lines):
 // Single query for vacant/available slots
 const {
     data: vacantSlotsRaw,
     isLoading: isVacantSlotsLoading,
     error: vacantSlotsError,
 } = useParkingSlots(buildingId, { available: true, enabled: open && Boolean(buildingId) });

 // Current unit allocation slot IDs (edit mode)
 const currentUnitAllocationSlotIds = useMemo(() => {
     const ids = new Set<string>();
     (unitAllocationsQuery.data || []).forEach((alloc) => {
         const slotId = alloc.slot?.id ?? alloc.parkingSlotId;
         if (slotId) ids.add(String(slotId));
     });
     return ids;
 }, [unitAllocationsQuery.data]);

 // Merge vacant + currently-allocated (so edit mode shows allocated pre-checked)
 const vacantSlots = useMemo(() => {
     const apiSlots = (vacantSlotsRaw || []).filter((s) => s.isActive !== false);
     if (!isEditMode || !unitAllocationsQuery.data?.length) {
         return apiSlots.sort((a, b) => a.code.localeCompare(b.code));
     }
     const existingIds = new Set(apiSlots.map((s) => s.id));
     const allocatedAsSlots = (unitAllocationsQuery.data || [])
         .filter((alloc) => {
             const id = alloc.slot?.id ?? alloc.parkingSlotId;
             return id && !existingIds.has(String(id));
         })
         .map((alloc) => ({
             id: String(alloc.slot?.id ?? alloc.parkingSlotId),
             buildingId,
             code: alloc.slot?.code ?? "",
             level: alloc.slot?.level ?? null,
             type: alloc.slot?.type ?? "CAR",
             isCovered: false,
             isActive: true,
             createdAt: "",
         }));
     return [...apiSlots, ...allocatedAsSlots].sort((a, b) => a.code.localeCompare(b.code));
 }, [vacantSlotsRaw, isEditMode, unitAllocationsQuery.data, buildingId]);

 Keep the existing useEffect that pre-selects allocated slots in edit mode (lines 349-355).

 Step 4: CreateUnitSheet — Simplify parking UI in step 0

 Replace the parking section (lines 929-1096, ~170 lines) with a clean version (~50 lines):
 - Show vacant slot checkboxes (same as now)
 - In edit mode, show "(allocated)" badge on currently-allocated slots
 - Remove "Unit allocations" info box, "Existing unit slots" with Edit/Activate buttons, "Tenant vehicles" section

 Step 5: CreateUnitSheet — Fix step render order

 Swap showStep(5) (Compliance, line 1442) and showStep(4) (Utilities, line 1493) so they render in correct order: Utilities first, then Compliance.

 Step 6: CreateUnitSheet — Fix AnimatePresence in single layout

 In single layout mode, skip the animation wrapper — use a plain <div> with a static key instead of motion.div keyed by stepIndex.

 Step 7: CreateUnitSheet — Remove dead code

 - Delete commented-out code blocks (lines 649-695)
 - Remove CreateParkingSlotSheet sub-modal (lines 1779-1787)
 - Remove updateParkingSlot.isPending from isCreatingSlots (line 710)

 Step 8: UnitDetailSheet — Add parking allocations section

 Add useUnitParkingAllocations(unitId) hook and render a "Parking" card between the Utilities and Residents sections (after line 251), showing allocated slot codes, types, and levels.

 ---
 Verification

 - Run npm run build to catch TypeScript errors
 - Verify create flow: open CreateUnitSheet → see vacant slots → select → create unit → slots allocated
 - Verify edit flow: open in edit mode → see pre-checked allocated slots + vacant → change selection → save → allocations updated
 - Verify UnitDetailSheet shows allocated parking slots
