'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framermotion';
import {
  PlusCircle,
  ChevronRight,
  Clock,
  FileText,
  Wrench,
  Shield,
  MessageSquare,
  ShieldCheck,
} from 'lucidereact';
import { cn } from '@/lib/utils';

import { getStatusConfig } from '@/lib/constants/incidentStatus';
import { IncidentDetailDrawer } from '@/components/incidents/incidentdetaildrawer';
import { WelcomeOverlay } from '@/components/auth/WelcomeOverlay';

//  Types 

interface IncidentRow {
  id: number;
  reference: string;
  declaredAt: string;
  category: string;
  status: string;
  description: string;
}

//  Relative date helpers for mock data 

/** Return an ISO date string `daysAgo` days before now, with a pseudounique hour offset. */
function daysAgo(days: number, hourOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate()  days);
  d.setHours(8 + hourOffset, 15 + (hourOffset * 7) % 60, 0, 0);
  return d.toISOString();
}

//  Mock data with timestamps spanning 3 recency buckets 

const MOCK_INCIDENTS: IncidentRow[] = [
  // Aujourd'hui (today)
  { id: 1, reference: 'INC202607290001', declaredAt: daysAgo(0, 1), category: 'Sécurité', status: 'DECLARED', description: 'Barrière de sécurité endommagée sur la ligne 3' },
  { id: 2, reference: 'INC202607290002', declaredAt: daysAgo(0, 3), category: 'Accident', status: 'CLAIMED', description: 'Opérateur a glissé sur une flaque d\'huile' },
  // Cette semaine (within 7 days, not today)
  { id: 3, reference: 'INC202607260001', declaredAt: daysAgo(3, 2), category: 'Réclamation', status: 'IN_PROGRESS', description: 'Bruit anormal provenant du moteur principal' },
  { id: 4, reference: 'INC202607240001', declaredAt: daysAgo(5, 4), category: 'Sécurité', status: 'RESOLVED', description: 'Extincteur manquant au poste de soudure' },
  // Plus ancien (over 7 days)
  { id: 5, reference: 'INC202607150001', declaredAt: daysAgo(14, 0), category: 'Accident', status: 'CLOSED', description: 'Coupure légère lors du changement de lame' },
  { id: 6, reference: 'INC202607100001', declaredAt: daysAgo(19, 5), category: 'Réclamation', status: 'NON_RESOLVED', description: 'Pièces de rechange non conformes livrées' },
];

//  Date Helpers 

/** Full date/time (DD/MM/YYYY HH:mm) for tooltip. */
function formatDateTimeFR(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Relative humanfriendly timestamp (French). */
function relativeTime(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime()  d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHours < 24) return `il y a ${diffHours} h`;
  if (diffDays === 1) return 'il y a 1 jour';
  if (diffDays < 30) return `il y a ${diffDays} jours`;
  if (diffDays < 365) return `il y a ${Math.floor(diffDays / 30)} mois`;
  return `il y a ${Math.floor(diffDays / 365)} ans`;
}

/** Check if two Date objects fall on the same calendar day. */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

//  Date Bucketing 

type BucketKey = 'aujourdhui' | 'cette_semaine' | 'plus_ancien';

interface Bucket {
  key: BucketKey;
  label: string;
  incidents: IncidentRow[];
}

function getDateBuckets(incidents: IncidentRow[]): Bucket[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(today.getTime()  7 * 86400000);

  const buckets: Record<BucketKey, IncidentRow[]> = {
    aujourdhui: [],
    cette_semaine: [],
    plus_ancien: [],
  };

  for (const inc of incidents) {
    const d = new Date(inc.declaredAt);
    const incDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (isSameDay(incDate, today)) {
      buckets.aujourdhui.push(inc);
    } else if (incDate >= sevenDaysAgo) {
      buckets.cette_semaine.push(inc);
    } else {
      buckets.plus_ancien.push(inc);
    }
  }

  // Return only nonempty buckets, preserving chronological order
  return (
    [
      { key: 'aujourdhui' as const, label: "Aujourd'hui", incidents: buckets.aujourdhui },
      { key: 'cette_semaine' as const, label: 'Cette semaine', incidents: buckets.cette_semaine },
      { key: 'plus_ancien' as const, label: 'Plus ancien', incidents: buckets.plus_ancien },
    ] as Bucket[]
  ).filter((b) => b.incidents.length > 0);
}

//  Category Badge (tinted pill) 

const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  Sécurité: {
    bg: 'bgamber50 dark:bgamber950/60',
    text: 'textamber700 dark:textamber300',
    icon: <Shield className="h3 w3" />,
  },
  Accident: {
    bg: 'bgred50 dark:bgred950/60',
    text: 'textred700 dark:textred300',
    icon: <Wrench className="h3 w3" />,
  },
  Réclamation: {
    bg: 'bgblue50 dark:bgblue950/60',
    text: 'textblue700 dark:textblue300',
    icon: <MessageSquare className="h3 w3" />,
  },
};

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? {
    bg: 'bgslate100 dark:bgslate800',
    text: 'textslate600 dark:textslate300',
    icon: <FileText className="h3 w3" />,
  };
  return (
    <span className={cn('inlineflex itemscenter gap1 roundedmd px1.5 py0.5 text[11px] fontmedium', style.bg, style.text)}>
      {style.icon}
      {category}
    </span>
  );
}

//  Section Sticky Header 

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="sticky top0 z10 bgslate50/90 dark:bgslate900/90 backdropblursm py2 borderb borderslate200/60 dark:borderslate800/60 mb2">
      <span className="textxs fontbold uppercase trackingwider textslate500 dark:textslate400">
        {label}
      </span>
    </div>
  );
}

//  Incident Card 

function IncidentCard({
  incident,
  onSelect,
}: {
  incident: IncidentRow;
  onSelect: (id: string) => void;
}) {
  const config = getStatusConfig(incident.status);

  return (
    <button
      type="button"
      onClick={() => onSelect(String(incident.id))}
      className={cn(
        'wfull textleft roundedxl border borderslate200/80 dark:borderslate800',
        'bgwhite dark:bgslate900 shadowsm',
        'borderl4',
        config.barClass,
        'overflowhidden p4',
        'spacey3',
        'transitionall duration150',
        'active:scale[0.98] active:bgslate100 dark:active:bgslate800',
        'hover:borderslate300 dark:hover:borderslate700',
        'hover:shadowmd',
        'focusvisible:outlinenone focusvisible:ring2 focusvisible:ringprimary/40',
        'cursorpointer selectnone',
      )}
    >
      {/* Line 1: Reference + Tinted category badge | Relative timestamp */}
      <div className="flex itemscenter justifybetween gap2">
        <div className="flex itemscenter gap2 minw0">
          <span className="fontmono textsm fontbold textslate900 dark:textslate100 truncate">
            {incident.reference}
          </span>
          <CategoryBadge category={incident.category} />
        </div>
        <span
          className="textxs textslate400 dark:textslate500 shrink0 whitespacenowrap"
          title={formatDateTimeFR(incident.declaredAt)}
        >
          {relativeTime(incident.declaredAt)}
        </span>
      </div>

      {/* Description excerpt */}
      <p className="textxs textslate500 dark:textslate400 lineclamp1 mt1 leadingrelaxed">
        {incident.description}
      </p>

      {/* Line 3: Status label | Highcontrast chevron */}
      <div className="flex itemscenter justifybetween">
        <span className={cn('textsm fontmedium', config.textClass)}>
          {config.labelFr}
        </span>
        <ChevronRight className="h4 w4 textslate600 dark:textslate300 transitioncolors grouphover:textslate900" />
      </div>
    </button>
  );
}

//  Empty State 

function EmptyState({ onDeclare }: { onDeclare: () => void }) {
  return (
    <div className="flex flexcol itemscenter justifycenter py16 px4 textcenter">
      <ShieldCheck className="textslate300 dark:textslate700 w16 h16 mb4" />
      <p className="textbase fontmedium textslate600 dark:textslate400 mb6">
        Vous n&apos;avez aucun incident en cours.
      </p>
      <button
        type="button"
        onClick={onDeclare}
        className={cn(
          'flex itemscenter gap3 rounded2xl px6 py4',
          'bgblue600 hover:bgblue700 active:bgblue800',
          'textwhite shadowlg',
          'transitionall duration200',
          'hover:shadowxl active:shadowsm',
          'focusvisible:outlinenone focusvisible:ring2 focusvisible:ringblue400 focusvisible:ringoffset2',
        )}
      >
        <PlusCircle className="h6 w6 shrink0" />
        <span className="fontsemibold textbase">Déclarer un incident</span>
        <ChevronRight className="h5 w5 mlauto shrink0 textwhite/70" />
      </button>
    </div>
  );
}

//  Page 

export default function SousChefIncidentsPage() {
  const router = useRouter();

  // Welcome overlay
  const [showWelcome, setShowWelcome] = useState(true);

  // Drawer
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);

  // Memoised date buckets
  const buckets = useMemo(() => getDateBuckets(MOCK_INCIDENTS), []);

  // Derived counts
  const totalDeclared = MOCK_INCIDENTS.length;
  const enCours = MOCK_INCIDENTS.filter(
    (i) => i.status === 'IN_PROGRESS' || i.status === 'CLAIMED',
  ).length;

  const goToDeclare = useCallback(() => router.push('/souschef/incidents/declare'), [router]);

  return (
    <>
      {/*  Welcome Overlay  */}
      <WelcomeOverlay
        isVisible={showWelcome}
        onDismiss={() => setShowWelcome(false)}
        autoDismissMs={2600}
      />

      {/*  Desktop width cap  */}
      <div className="maxw5xl mxauto">
        {/* pb28 on mobile clears the floating CTA; md:pb0 resets on desktop */}
        <div className="spacey5 pb32 sm:pb36 md:pb6">
          {/* Header */}
          <div>
            <h1 className="text2xl fontbold trackingtight">Mes Incidents</h1>
            <p className="mt1 textsm textmutedforeground">
              Consultez vos incidents déclarés
            </p>
          </div>

          {/* Desktop Hero CTA (hidden on mobile) */}
          <div className="hidden md:block">
            <motion.button
              type="button"
              onClick={goToDeclare}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'group relative flex wfull itemscenter gap4 rounded2xl p6',
                'bgblue600 hover:bgblue700 active:bgblue800',
                'textwhite shadowlg',
                'transitionall duration200',
                'hover:shadowxl active:shadowsm',
                'focusvisible:outlinenone focusvisible:ring2 focusvisible:ringblue400 focusvisible:ringoffset2',
                'minh[72px]',
              )}
            >
              <div className="flex h12 w12 shrink0 itemscenter justifycenter roundedxl bgwhite/20 backdropblursm">
                <PlusCircle className="h7 w7 textwhite" />
              </div>
              <div className="flex flexcol itemsstart gap0.5">
                <span className="textlg fontbold leadingtight trackingtight">
                  Déclarer un incident
                </span>
                <span className="textsm textblue100/80">
                  Signaler un problème sur votre poste de travail
                </span>
              </div>
              <div className="mlauto shrink0 textwhite/40 grouphover:textwhite/60 transitioncolors">
                <ChevronRight className="h6 w6" />
              </div>
            </motion.button>
          </div>

          {/* Activity summary */}
          <div className="flex itemscenter gap2 textsm fontmedium textslate500 dark:textslate400">
            <Clock className="h4 w4" />
            <span>
              {totalDeclared} incident{totalDeclared > 1 ? 's' : ''} déclaré
              {totalDeclared > 1 ? 's' : ''}
            </span>
            <span className="textslate300 dark:textslate600">·</span>
            <span>{enCours} en cours</span>
          </div>

          {/* Sectioned incident feed */}
          <div className="spacey6">
            {totalDeclared === 0 ? (
              <EmptyState onDeclare={goToDeclare} />
            ) : (
              buckets.map((bucket) => (
                <div key={bucket.key} className="spacey3">
                  <SectionHeader label={bucket.label} />
                  {bucket.incidents.map((inc) => (
                    <IncidentCard
                      key={inc.id}
                      incident={inc}
                      onSelect={(id) => setDrawerIncidentId(id)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile fixed CTA — rightaligned with periodic attention wiggle */}
      <div className="md:hidden fixed bottom6 right6 z50">
        <motion.button
          type="button"
          onClick={goToDeclare}
          whileTap={{ scale: 0.92 }}
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 4, 4, 0],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            repeatDelay: 5,
            ease: 'easeInOut',
          }}
          className={cn(
            'flex itemscenter justifycenter gap2 roundedxl px5 py3',
            'bgblue600 hover:bgblue700 active:bgblue800',
            'textwhite shadowxl',
            'focusvisible:outlinenone focusvisible:ring2 focusvisible:ringblue400 focusvisible:ringoffset2',
          )}
        >
          <PlusCircle className="h6 w6 shrink0" />
          <span className="fontsemibold textbase whitespacenowrap">Déclarer</span>
        </motion.button>
      </div>

      {/* Incident detail drawer */}
      <IncidentDetailDrawer
        incidentId={drawerIncidentId}
        onClose={() => setDrawerIncidentId(null)}
      />
    </>
  );
}
