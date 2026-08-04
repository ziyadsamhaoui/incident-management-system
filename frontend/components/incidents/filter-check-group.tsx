'use client';

import { cn } from '@/lib/utils';

interface FilterCheckGroupProps {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}

/**
 * Chip-style multi-select used inside the mobile/tablet filter dialogs
 * (shared by the Incidents page and the Logs archive).
 */
export function FilterCheckGroup({ options, selected, onToggle }: FilterCheckGroupProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSel = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
              isSel
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-input text-muted-foreground hover:border-muted-foreground/30',
            )}
          >
            {isSel && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
