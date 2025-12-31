import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RevalidationIndicatorProps {
  isRefetching?: boolean;
  className?: string;
}

/**
 * Non-blocking indicator that shows when data is being revalidated in the background.
 * Shows a subtle spinner and "Refreshing..." text when data is being fetched.
 */
export function RevalidationIndicator({ isRefetching, className }: RevalidationIndicatorProps) {
  if (!isRefetching) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-full border border-zinc-200/80 shadow-sm text-xs text-zinc-600',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        className
      )}
    >
      <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
      <span className="font-medium">Refreshing...</span>
    </div>
  );
}

