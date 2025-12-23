import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50">
            {Icon && (
                <div className="p-4 bg-zinc-100 rounded-full mb-4">
                    <Icon className="w-8 h-8 text-zinc-400" />
                </div>
            )}
            <h3 className="text-lg font-semibold text-zinc-900 mb-1">{title}</h3>
            <p className="text-zinc-500 max-w-sm mb-6">{description}</p>
            {actionLabel && onAction && (
                <Button onClick={onAction} variant="outline">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
