import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBuildingLocation(building: {
  address?: string | null
  city?: string | null
  emirate?: string | null
  country?: string | null
}) {
  if (building.address) return building.address
  return [building.city, building.emirate, building.country].filter(Boolean).join(", ")
}
