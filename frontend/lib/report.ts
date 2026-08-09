/**
 * Analytical report export engine — builds the downloadable "Monthly Safety
 * & Operational Report" (CSV + PDF) from the /analytics page state.
 *
 * Sections (aligned with the page): key indicators, volume trend buckets,
 * Pareto 80/20 summary, department distribution, repeat-incident signals and
 * (ADMIN only) team workload. Both formats consume the same data bundle so
 * the exported content always matches what is on screen.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCsv } from '@/lib/csv';
import type {
  DepartmentVolume,
  MetricDelta,
  ParetoResponse,
  RepeatSignal,
  VolumeSpeedBucket,
  VolumeSpeedDeltas,
  VolumeSpeedTotals,
  WorkloadEntry,
} from '@/types/analytics';

/** Everything the report needs — assembled by the analytics page. */
export interface AnalyticsReportData {
  rangeLabel: string;
  departmentLabel: string;
  compare: boolean;
  totals: VolumeSpeedTotals;
  deltas: VolumeSpeedDeltas | null;
  buckets: VolumeSpeedBucket[];
  pareto: ParetoResponse;
  departments: DepartmentVolume[];
  signals: RepeatSignal[];
  workload: WorkloadEntry[] | null;
}

// ── Formatting helpers ─────────────────────────────

export function formatHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h)) return '—';
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin} min`;
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${hh}h ${mm.toString().padStart(2, '0')}m`;
}

function formatDelta(d: MetricDelta | null | undefined): string {
  if (!d || d.pct == null) return 'N/A';
  return `${d.pct > 0 ? '+' : ''}${d.pct.toFixed(1)} %`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "3 de 12 catégories concentrent 78.2 % des incidents" style sentence. */
function formatInsight(data: AnalyticsReportData): string {
  const ins = data.pareto.insight;
  if (!ins) return 'Aucun incident sur la période.';
  return `${ins.categoriesTo80} / ${ins.totalCategories} catégories concentrent ${ins.pctCovered.toFixed(1)} % des incidents.`;
}

// ── CSV export ─────────────────────────────────────

export function downloadAnalyticsCsv(data: AnalyticsReportData): void {
  const rows: (string | number | null)[][] = [];

  rows.push(['RAPPORT MENSUEL — SÉCURITÉ & EXPLOITATION', '', '']);
  rows.push(['Période', data.rangeLabel, '']);
  rows.push(['Département', data.departmentLabel, '']);
  rows.push(['Généré le', new Date().toLocaleString('fr-FR'), '']);
  rows.push(['', '', '']);

  // ── 1. Key indicators
  rows.push(['— INDICATEURS CLÉS —', '', '']);
  const deltas = data.deltas;
  rows.push(['Indicateur', 'Valeur', 'vs. période précédente']);
  rows.push(['Incidents déclarés', data.totals.reported,
    data.compare ? formatDelta(deltas?.reported) : '—']);
  rows.push(['Taux de résolution', `${data.totals.resolutionRatePct.toFixed(1)} %`,
    data.compare ? formatDelta(deltas?.resolutionRate) : '—']);
  rows.push(['MTTR (durée moyenne de résolution)', formatHours(data.totals.mttrHours),
    data.compare ? formatDelta(deltas?.mttr) : '—']);
  rows.push(['Temps moyen de prise en charge', formatHours(data.totals.timeToClaimHours),
    data.compare ? formatDelta(deltas?.timeToClaim) : '—']);
  rows.push(['', '', '']);

  // ── 2. Volume trend buckets
  rows.push(['— VOLUME PAR PÉRIODE —', '', '']);
  rows.push(['Période', 'Déclarés', 'Résolus / Non résolus']);
  for (const b of data.buckets) {
    rows.push([formatDate(b.label), b.reported, `${b.resolved} / ${b.nonResolved}`]);
  }
  rows.push(['', '', '']);

  // ── 3. Pareto summary
  rows.push(['— ANALYSE PARETO (80/20) —', '', '']);
  rows.push([formatInsight(data), '', '']);
  rows.push(['Catégorie', 'Incidents', 'Part cumulée']);
  for (const c of data.pareto.categories) {
    rows.push([c.name, c.count, `${c.cumulativePct.toFixed(1)} %`]);
  }
  rows.push(['', '', '']);

  // ── 4. Department distribution
  if (data.departments.length > 0) {
    rows.push(['— RÉPARTITION PAR DÉPARTEMENT —', '', '']);
    rows.push(['Département', 'Incidents', '']);
    for (const d of data.departments) {
      rows.push([d.name, d.count, '']);
    }
    rows.push(['', '', '']);
  }

  // ── 5. Repeat signals
  rows.push(['— SIGNAL RÉCURRENT (≥ 3 incidents / 14 jours) —', '', '']);
  if (data.signals.length === 0) {
    rows.push(['Aucun signal de récurrence détecté.', '', '']);
  } else {
    rows.push(['Station', 'Catégorie', 'Incidents']);
    for (const s of data.signals) {
      rows.push([`${s.stationCode ?? '—'} (${s.departmentName ?? '—'})`, s.categoryName ?? '—', s.incidentCount]);
    }
  }
  rows.push(['', '', '']);

  // ── 6. Team workload (ADMIN only)
  if (data.workload && data.workload.length > 0) {
    rows.push(['— CHARGE DE TRAVAIL ÉQUIPE (AGREGAT) —', '', '']);
    rows.push(['Membre', 'Pris en charge', 'Résolus', 'Non résolus', 'Durée moy. résolution']);
    for (const w of data.workload) {
      rows.push([`${w.firstName} ${w.lastName}`, w.claimedCount, w.resolvedCount,
        w.nonResolvedCount, formatHours(w.avgResolutionHours)]);
    }
  }

  const filename = `rapport-securite-${data.rangeLabel.replace(/\s+/g, '-')}.csv`;
  downloadCsv(filename, ['Section', 'Détail', 'Valeur'], rows);
}

// ── PDF export ─────────────────────────────────────

export function downloadAnalyticsPdf(data: AnalyticsReportData): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;

  // Header block
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Rapport mensuel — Sécurité & Exploitation', margin, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Période : ${data.rangeLabel}    |    Département : ${data.departmentLabel}`, margin, 23);
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, margin, 28);

  // ── 1. Key indicators
  const deltas = data.deltas;
  autoTable(doc, {
    startY: 34,
    head: [['Indicateur', 'Valeur', 'vs. période précédente']],
    body: [
      ['Incidents déclarés', String(data.totals.reported),
        data.compare ? formatDelta(deltas?.reported) : '—'],
      ['Taux de résolution', `${data.totals.resolutionRatePct.toFixed(1)} %`,
        data.compare ? formatDelta(deltas?.resolutionRate) : '—'],
      ['MTTR (durée moyenne de résolution)', formatHours(data.totals.mttrHours),
        data.compare ? formatDelta(deltas?.mttr) : '—'],
      ['Temps moyen de prise en charge', formatHours(data.totals.timeToClaimHours),
        data.compare ? formatDelta(deltas?.timeToClaim) : '—'],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    margin: { left: margin, right: margin },
  });

  let y = (doc as any).lastAutoTable.finalY + 8;

  // ── 2. Volume trend buckets
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Volume des incidents par période', margin, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [['Période', 'Déclarés', 'Résolus', 'Non résolus', 'MTTR', 'Prise en charge']],
    body: data.buckets.map((b) => [
      formatDate(b.label), b.reported, b.resolved, b.nonResolved,
      formatHours(b.mttrHours), formatHours(b.timeToClaimHours),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 3. Pareto
  doc.text('Analyse Pareto (80/20) — ' + formatInsight(data), margin, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [['Catégorie', 'Incidents', 'Part cumulée']],
    body: data.pareto.categories.map((c) => [
      c.name, c.count, `${c.cumulativePct.toFixed(1)} %`,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 4. Departments
  if (data.departments.length > 0) {
    doc.text('Répartition par département', margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [['Département', 'Incidents']],
      body: data.departments.map((d) => [d.name, d.count]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 5. Repeat signals
  doc.text('Signal récurrent (≥ 3 incidents sur la même station / 14 jours)', margin, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [['Station', 'Catégorie', 'Incidents', 'Premier', 'Dernier']],
    body: data.signals.map((s) => [
      `${s.stationCode ?? '—'} (${s.departmentName ?? '—'})`,
      s.categoryName ?? '—',
      s.incidentCount,
      s.firstOccurrence ? formatDate(s.firstOccurrence.slice(0, 10)) : '—',
      s.lastOccurrence ? formatDate(s.lastOccurrence.slice(0, 10)) : '—',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 38, 38], fontSize: 8 },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 6. Workload (ADMIN only)
  if (data.workload && data.workload.length > 0) {
    doc.text('Charge de travail de l’équipe (indicateurs agrégés)', margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [['Membre', 'Pris en charge', 'Résolus', 'Non résolus', 'Total évaluations', 'Durée moy. résolution']],
      body: data.workload.map((w) => [
        `${w.firstName} ${w.lastName}`, w.claimedCount, w.resolvedCount,
        w.nonResolvedCount, w.evaluatedCount, formatHours(w.avgResolutionHours),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      margin: { left: margin, right: margin },
    });
  }

  const filename = `rapport-securite-${data.rangeLabel.replace(/\s+/g, '-')}.pdf`;
  doc.save(filename);
}
