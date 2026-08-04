'use client';

import { useState } from 'react';
import { Search, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MultiSelectDropdown, type MultiSelectOption } from '@/components/incidents/multi-select-dropdown';
import { FilterCheckGroup } from '@/components/incidents/filter-check-group';
import { useTranslation } from '@/lib/i18n';

interface LogsFilterBarProps {
  /** Search term (matched client-side over reference / description / resolutionNote). */
  search: string;
  onSearchChange: (v: string) => void;
  categoryOptions: MultiSelectOption[];
  selectedCategories: string[];
  onCategoriesChange: (v: string[]) => void;
  priorityOptions: MultiSelectOption[];
  selectedPriorities: string[];
  onPrioritiesChange: (v: string[]) => void;
  /** Inclusive resolvedAt range. Empty string = unset. */
  dateFrom: string;
  dateTo: string;
  onDateRangeChange: (from: string, to: string) => void;
  /** ADMIN only — scoped by department server-side. */
  departmentOptions?: MultiSelectOption[];
  departmentId?: number | '';
  onDepartmentChange?: (id: number | '') => void;
  /** Clears every Logs filter (search, dept, category, priority, dates). */
  onReset: () => void;
}

/**
 * Logs filter row — mirrors the Incidents page UX: a search input plus a
 * filter-dialog button on small & medium displays (< lg), and the full inline
 * filter row (department / category / priority / date range) on large screens.
 */
export function LogsFilterBar({
  search,
  onSearchChange,
  categoryOptions,
  selectedCategories,
  onCategoriesChange,
  priorityOptions,
  selectedPriorities,
  onPrioritiesChange,
  dateFrom,
  dateTo,
  onDateRangeChange,
  departmentOptions,
  departmentId,
  onDepartmentChange,
  onReset,
}: LogsFilterBarProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const hasFilters =
    search.trim() !== '' ||
    selectedCategories.length > 0 ||
    selectedPriorities.length > 0 ||
    dateFrom !== '' ||
    dateTo !== '' ||
    (departmentId !== undefined && departmentId !== '');

  // Badge count on the mobile filter tab (excludes search — it has its own input).
  const activeFilterCount =
    selectedCategories.length +
    selectedPriorities.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (departmentId !== undefined && departmentId !== '' ? 1 : 0);

  const toggleDepartment = (value: string) => {
    if (!onDepartmentChange) return;
    onDepartmentChange(value === '' ? '' : Number(value));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search + mobile/tablet filter tab (< lg) */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.logsSearchPlaceholder}
              className="h-10 w-full pl-9"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-muted lg:hidden"
            aria-label={t.logsFiltersTitle}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop filters (lg+) */}
        <div className="hidden lg:flex flex-wrap items-center gap-2">
          {departmentOptions && onDepartmentChange && (
            <select
              value={String(departmentId ?? '')}
              onChange={(e) => onDepartmentChange(e.target.value ? Number(e.target.value) : '')}
              aria-label={t.logsFilterDepartment}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-muted-foreground outline-none appearance-none cursor-pointer hover:border-muted-foreground/30"
            >
              <option value="">{t.logsFilterAllDepartments}</option>
              {departmentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          <MultiSelectDropdown
            label={t.logsFilterCategory}
            options={categoryOptions}
            selected={selectedCategories}
            onChange={onCategoriesChange}
          />

          <MultiSelectDropdown
            label={t.logsFilterPriority}
            options={priorityOptions}
            selected={selectedPriorities}
            onChange={onPrioritiesChange}
          />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t.logsFilterFrom}
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateRangeChange(e.target.value, dateTo)}
              aria-label={t.logsFilterFrom}
              title={t.logsFilterFrom}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t.logsFilterTo}
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateRangeChange(dateFrom, e.target.value)}
              aria-label={t.logsFilterTo}
              title={t.logsFilterTo}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              {t.logsFilterReset}
            </Button>
          )}
        </div>
      </div>

      {/* Filter dialog (small & medium displays) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.logsFiltersTitle}</DialogTitle>
            <DialogDescription>{t.logsFiltersDesc}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2 pr-1">
            {departmentOptions && onDepartmentChange && (
              <div className="space-y-1.5">
                <Label>{t.logsFilterDepartment}</Label>
                <FilterCheckGroup
                  options={[{ value: '', label: t.logsFilterAllDepartments }, ...departmentOptions]}
                  selected={departmentId !== undefined && departmentId !== '' ? [String(departmentId)] : ['']}
                  onToggle={toggleDepartment}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t.logsFilterCategory}</Label>
              <FilterCheckGroup options={categoryOptions} selected={selectedCategories} onToggle={(v) => onCategoriesChange(
                selectedCategories.includes(v) ? selectedCategories.filter((c) => c !== v) : [...selectedCategories, v],
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.logsFilterPriority}</Label>
              <FilterCheckGroup options={priorityOptions} selected={selectedPriorities} onToggle={(v) => onPrioritiesChange(
                selectedPriorities.includes(v) ? selectedPriorities.filter((p) => p !== v) : [...selectedPriorities, v],
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.logsColResolvedDate}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateRangeChange(e.target.value, dateTo)}
                  aria-label={t.logsFilterFrom}
                  className="h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
                <span className="text-xs text-muted-foreground">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateRangeChange(dateFrom, e.target.value)}
                  aria-label={t.logsFilterTo}
                  className="h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            >
              {t.logsFilterReset}
            </Button>
            <Button
              onClick={() => setOpen(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t.logsApply}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
