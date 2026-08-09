'use client';

import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import {
  downloadAnalyticsCsv,
  downloadAnalyticsPdf,
  type AnalyticsReportData,
} from '@/lib/report';

interface ExportDropdownProps {
  /** Assembled report data; disabled while still loading. */
  report: AnalyticsReportData | null;
}

/**
 * Section 8 — Analytical data export engine.
 * [Exporter le Rapport] dropdown producing the "Monthly Safety & Operational
 * Report" in CSV or PDF from the current page state.
 */
export function ExportDropdown({ report }: ExportDropdownProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={!report}
          className="h-9 gap-1.5 text-xs"
          title={t.analyticsExportDesc}
        >
          <FileDown className="h-3.5 w-3.5" />
          {t.analyticsExport}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t.analyticsExportDesc}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!report}
          onClick={() => report && downloadAnalyticsCsv(report)}
          className="cursor-pointer"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          {t.analyticsExportCsv}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!report}
          onClick={() => report && downloadAnalyticsPdf(report)}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4 text-red-500 dark:text-red-400" />
          {t.analyticsExportPdf}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
