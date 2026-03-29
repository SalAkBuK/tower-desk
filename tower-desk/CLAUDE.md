# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TowerDesk is a Next.js 16.1.0-based building management system with role-based access control for managing buildings, service requests, users, and administrative operations. The application supports six user roles: superadmin, admin, manager, service_provider, employee, and tenant.

## Development Commands

```bash
npm run dev                    # Start development server (http://localhost:3000)
npm run build                  # Create production build
npm start                      # Start production server
npm run lint                   # Run ESLint
npm run security:check         # Run security audit
```

## Architecture Overview

### Technology Stack

- **Next.js 16.1.0** with App Router
- **React 19.2.3** with TypeScript (strict mode)
- **Zustand 5.0.9** for client-side auth state (persisted to LocalStorage)
- **TanStack React Query 5.90.12** for server state management and caching
- **Shadcn UI** + **Radix UI** component library
- **Tailwind CSS 4** for styling
- **React Hook Form 7.68.0** + **Zod 4.2.1** for forms and validation
- **Sonner 2.0.7** for toast notifications

### API Integration

**Base Configuration** (`src/lib/api/client.ts` + `src/lib/api/*`):
- API requests go through Next.js proxy: `/api/proxy/*` → `http://16.171.240.211/api/*`
- Proxy configured in `next.config.ts` rewrites
- Bearer token automatically attached to all requests except `/Auth/login`
- Toggle `USE_MOCK = false` to switch between real API and mock data

**Status Mapping**:
- API numbers (1-6) map to: pending, assigned, in-progress, on-hold, completed, cancelled
- Priority numbers (1-4) map to: low, medium, high, urgent

### Data Flow

```
Components -> React Query hooks (`src/lib/queries.ts` compatibility barrel / `src/lib/queries/*`) -> API domain modules (`src/lib/api/*`) -> Backend
```

All data fetching uses React Query hooks for automatic caching, refetching, and cache invalidation.

### Authentication & Authorization

**Auth Store** (`src/lib/auth.ts`):
- Zustand store with LocalStorage persistence
- JWT token-based authentication
- State: `{ user, token, selectedBuildingId, isAuthenticated }`

**Role Permissions** (via `can()` method):
```typescript
superadmin:       ['*']
admin:            ['manage:users', 'view:users', 'manage:requests',
                   'view:requests', 'assign:requests', 'view:buildings', 'edit:buildings']
manager:          ['view:users', 'view:requests', 'create:requests', 'assign:requests']
service_provider: ['view:requests', 'update:requests']
employee:         ['view:requests', 'update:requests']
tenant:           ['create:requests', 'view:requests']
```

**Route Protection** (`src/app/(dashboard)/layout.tsx`):
- Checks authentication on mount (prevents hydration issues)
- Role-based route access: `/sa/*` (superadmin), `/admin/*` (admin+), `/manager/*` (manager+)
- Redirects unauthorized users to `/403`

### Core Entity Types

Defined in `src/lib/types.ts`:

**User**:
```typescript
{
  id: string
  name: string
  email: string
  role: 'superadmin' | 'admin' | 'manager' | 'service_provider' | 'employee' | 'tenant'
  buildingIds: string[]
  avatarUrl?: string
  fullName?: string
  phoneNumber?: string
  // ...
}
```

**Building**:
```typescript
{
  id: string
  name: string
  address: string
  status: 'active' | 'maintenance' | 'inactive'
  unitsCount?: number
  stats?: { totalTenants, activeRequests, occupancyRate }
  // ...
}
```

**ServiceRequest**:
```typescript
{
  id: string
  title: string
  description: string
  status: 'pending' | 'assigned' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  buildingId: string
  createdByTenantId: string
  assignedEmployeeId?: string
  assignedTo?: { id, fullName, email }
  comments?: RequestComment[]
  attachments?: RequestAttachment[]
  statusHistory?: RequestStatusHistory[]
  // ...
}
```

### Directory Structure

```
src/
  app/                           # Next.js App Router
    (auth)/login/                # Login page
    (dashboard)/                 # Protected dashboard routes
      admin/                     # Admin portal (requests, buildings, users)
      manager/                   # Manager portal
      sa/                        # Super Admin portal
    403/                         # Access forbidden page
    layout.tsx                   # Root layout with providers

  components/
    ui/                          # Shadcn UI components (Button, Dialog, Table, etc.)
    layout/                      # AppLayout, Sidebar, Topbar
    requests/                    # RequestsTable, RequestsGrid, RequestDetailSheet
    buildings/                   # Building management components
    users/                       # User management components
    common/                      # EmptyState, ConfirmDialog, SlideOver
    providers.tsx                # QueryClientProvider, Toaster setup

  lib/
    types.ts                     # TypeScript type definitions
    auth.ts                      # Zustand auth store + RBAC
    api/                         # API client + domain modules
      client.ts                  # Shared fetch/auth handling
      *.ts                       # Domain APIs (auth, parking, contracts, etc.)
    queries/                     # Domain React Query hooks
    queries.ts                   # Compatibility barrel for hooks
    utils.ts                     # Utility functions (cn, date formatters)
```

### Component Patterns

**Page Template** (requests management):
```typescript
// Features common to request pages:
- Building filter dropdown (admin/superadmin only)
- View toggle (table/grid)
- Status tabs (All, New, In Progress, On Hold, Completed, Cancelled)
- RequestsTable or RequestsGrid component
- RequestDetailSheet for viewing/editing requests
```

**Sheet Components** (slide-out panels):
- `RequestDetailSheet` - View/edit request with comments, attachments, status updates
- `CreateBuildingSheet` - New building form
- `CreateUserSheet` - New user form
- `AssignAdminSheet` - Admin assignment

**Layout Components**:
- `AppLayout` - Main wrapper with responsive sidebar (desktop) and sheet menu (mobile)
- `Sidebar` - Role-based navigation menu with active route highlighting
- `Topbar` - User profile, search, settings

### React Query Hooks

Hook implementations are organized under `src/lib/queries/*` and re-exported via `src/lib/queries.ts`, including:
```typescript
// Data fetching
useBuildings()
useAdminBuildings(adminId)
useManagerBuildings(managerId)
useRequests(buildingId)
useAllRequests()
useRequest(requestId)
useAdminUsers()
useManagerUsers()

// Mutations (with automatic cache invalidation)
useCreateBuilding()
useAssignAdmin()
useCreateRequest()
useUpdateRequestStatus(requestId)
useAssignRequest(requestId)
useAddComment(requestId)
useCreateUser()
useDeleteUser()
```

All mutations automatically invalidate relevant query caches for real-time UI updates.

### Form Handling

Standard pattern using React Hook Form + Zod:
```typescript
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: {}
})

const mutation = useCreateX()

const onSubmit = async (data: FormData) => {
  await mutation.mutateAsync(data)
  toast.success("Success message")
  onClose()
}
```

### Path Aliases

Configured in `tsconfig.json`:
```typescript
"@/*" → "./src/*"  // Example: import { cn } from "@/lib/utils"
```

Shadcn aliases (from `components.json`):
```typescript
"@/components"     // UI components
"@/lib"            // Business logic
"@/components/ui"  // Shadcn UI primitives
```

### Styling Conventions

- **Tailwind CSS 4** with CSS variables for theming
- **Shadcn New York** style variant
- **Neutral** base color scheme
- **Dark mode** support via next-themes
- **Class composition** with `cn()` utility (tailwind-merge + clsx)

### Security Configuration

**Next.js Security Headers** (`next.config.ts`):
- Content-Security-Policy (allows self + Cloudinary images)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security with 2-year max-age
- Permissions-Policy (camera, microphone, geolocation disabled)

**Authentication Security**:
- JWT tokens in Authorization header
- Protected routes with role-based guards
- Token persisted in LocalStorage (Zustand persist middleware)

### Key API Endpoints

**Buildings**:
- `GET /Buildings/getall` - All buildings
- `GET /BuildingAdmin/admin/{adminId}` - Buildings for admin
- `POST /Buildings` - Create building
- `PUT /BuildingAdmin/assign` - Assign admin

**Requests**:
- `GET /ServiceRequest/all` - All requests
- `GET /ServiceRequest/buildings/{buildingIds}` - Requests by buildings
- `GET /ServiceRequest/{id}` - Single request
- `POST /ServiceRequest` - Create request
- `PUT /ServiceRequest/{id}/status` - Update status
- `PUT /ServiceRequest/{id}/assign` - Assign request
- `POST /ServiceRequest/{id}/comments` - Add comment

**Users**:
- `GET /Users/admin/{buildingIds}` - Users for admin buildings
- `POST /Admins` - Create admin
- `POST /Managers` - Create manager
- `DELETE /Admins/{id}`, `DELETE /Managers/{id}` - Delete users

**Auth**:
- `POST /Auth/login` - Login with email/password

### Loading States & Error Handling

- **Skeleton components** for table/grid loading states
- **Toast notifications** via Sonner for user feedback
- **Try/catch** in all API calls with error logging
- **React Query** automatic retry and error states

### Common Development Patterns

**When adding a new feature**:
1. Define types in `src/lib/types.ts`
2. Create API functions in the appropriate `src/lib/api/*.ts` domain module
3. Create React Query hooks in the appropriate `src/lib/queries/*.ts` domain module and re-export when needed
4. Build UI components in `src/components/`
5. Add pages in `src/app/(dashboard)/[role]/`

**When adding RBAC permission**:
1. Add permission string to `PERMISSIONS` constant in `src/lib/auth.ts`
2. Update role mappings in `ROLE_PERMISSIONS`
3. Use `can(permission)` method in components for conditional rendering

**When adding a new route**:
1. Create page under `src/app/(dashboard)/[role]/`
2. Verify route protection works in layout
3. Add navigation link in `Sidebar.tsx` with role-based visibility

### TypeScript Configuration

- **Strict mode** enabled
- **Module resolution**: bundler
- **JSX**: react-jsx (automatic runtime)
- **Target**: ES2017
- **Path alias**: `@/*` points to `src/*`
