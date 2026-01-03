"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#0f172a",
          "--normal-border": "#d4d4d8",
          "--success-bg": "#d1fae5",
          "--success-text": "#065f46",
          "--success-border": "#34d399",
          "--error-bg": "#ffe4e6",
          "--error-text": "#9f1239",
          "--error-border": "#fb7185",
          "--warning-bg": "#fef3c7",
          "--warning-text": "#92400e",
          "--warning-border": "#f59e0b",
          "--info-bg": "#dbeafe",
          "--info-text": "#1d4ed8",
          "--info-border": "#60a5fa",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
