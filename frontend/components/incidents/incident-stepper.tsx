'use client';

import { cn, formatDateTime } from '@/lib/utils';
import type { IncidentStatus } from '@/types/incident';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
  UserCheck,
  Activity,
  CheckCheck,
} from 'lucide-react';

// ── Step definitions ─────────────────────────────

interface StepDefinition {
  key: string;
  label: string;
  icon: React.ElementType;
  /** The status value that marks this step as "reached" */
  threshold: IncidentStatus[];
  /** If true, show this step as completed when any of its threshold statuses match */
  isMulti?: boolean;
}

const STEPS: StepDefinition[] = [
  { key: 'DECLARED', label: 'Declared', icon: FileText, threshold: ['DECLARED'] },
  { key: 'CLAIMED', label: 'Claimed', icon: UserCheck, threshold: ['CLAIMED'] },
  {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    icon: Activity,
    threshold: ['IN_PROGRESS'],
  },
  {
    key: 'EVALUATED',
    label: 'Evaluated',
    icon: CheckCircle2,
    threshold: ['RESOLVED', 'NON_RESOLVED'],
    isMulti: true,
  },
  { key: 'CLOSED', label: 'Closed', icon: CheckCheck, threshold: ['CLOSED'] },
];

// ── Status → progress index mapping ──────────────

function statusToProgressIndex(status: IncidentStatus): number {
  switch (status) {
    case 'DECLARED':
      return 0;
    case 'CLAIMED':
      return 1;
    case 'IN_PROGRESS':
      return 2;
    case 'RESOLVED':
    case 'NON_RESOLVED':
      return 3;
    case 'CLOSED':
      return 4;
    default:
      return -1;
  }
}

// ── Props ─────────────────────────────────────────

interface IncidentStepperProps {
  status: IncidentStatus;
  declaredAt?: string | null;
  claimedAt?: string | null;
  inProgressAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  /** If true, evaluation was NON_RESOLVED (shows red styling on that step) */
  isNonResolved?: boolean;
}

// ── Component ─────────────────────────────────────

export function IncidentStepper({
  status,
  declaredAt,
  claimedAt,
  inProgressAt,
  resolvedAt,
  closedAt,
  isNonResolved,
}: IncidentStepperProps) {
  const currentIndex = statusToProgressIndex(status);

  const getTimestamp = (stepKey: string): string | null => {
    switch (stepKey) {
      case 'DECLARED':
        return declaredAt ?? null;
      case 'CLAIMED':
        return claimedAt ?? null;
      case 'IN_PROGRESS':
        return inProgressAt ?? null;
      case 'EVALUATED':
        return resolvedAt ?? null;
      case 'CLOSED':
        return closedAt ?? null;
      default:
        return null;
    }
  };

  const isStepCompleted = (stepIndex: number): boolean => {
    return stepIndex <= currentIndex;
  };

  const isStepCurrent = (stepIndex: number): boolean => {
    return stepIndex === currentIndex;
  };

  return (
    <div className="w-full">
      <div className="relative">
        {/* Vertical stepper on mobile, horizontal on md+ */}
        <div className="flex flex-col gap-0 md:flex-row md:items-start">
          {STEPS.map((step, index) => {
            const completed = isStepCompleted(index);
            const isCurrent = isStepCurrent(index);
            const timestamp = getTimestamp(step.key);

            // For the EVALUATED step, check if NON_RESOLVED
            const isNonResolvedStep = step.key === 'EVALUATED' && isNonResolved;
            const Icon = step.icon;

            const isLast = index === STEPS.length - 1;

            return (
              <div
                key={step.key}
                className={cn(
                  'relative flex md:flex-1 md:flex-col',
                  !isLast && 'pb-6 md:pb-0',
                )}
              >
                {/* Step indicator row */}
                <div className="flex items-start gap-3 md:flex-col md:items-center md:gap-2">
                  {/* Icon circle */}
                  <div
                    className={cn(
                      'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
                      completed && !isNonResolvedStep
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : isNonResolvedStep && completed
                          ? 'border-red-500 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-950/50 dark:text-red-400'
                          : isCurrent
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted-foreground/30 bg-background text-muted-foreground/50',
                    )}
                  >
                    {completed ? (
                      isNonResolvedStep ? (
                        <XCircle className="h-5 w-5" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5" />
                      )
                    ) : isCurrent ? (
                      <CircleDot className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </div>

                  {/* Label + timestamp — inline on mobile, below on md+ */}
                  <div className="min-w-0 md:text-center">
                    <p
                      className={cn(
                        'text-sm font-medium leading-tight',
                        completed
                          ? 'text-foreground'
                          : 'text-muted-foreground/60',
                      )}
                    >
                      {step.label}
                    </p>
                    {timestamp && completed && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70 leading-tight">
                        {formatDateTime(timestamp)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Connector line — vertical on mobile, horizontal on md+ */}
                {!isLast && (
                  <div
                    className={cn(
                      'absolute',
                      // Mobile: vertical line below the icon
                      'left-4 top-9 h-[calc(100%-2.25rem)] w-0.5',
                      // Desktop: horizontal line to the right
                      'md:left-[calc(50%+1.125rem)] md:top-[1.125rem] md:h-0.5 md:w-[calc(100%-2.25rem)]',
                    )}
                  >
                    <div
                      className={cn(
                        'h-full w-full transition-colors duration-500',
                        index < currentIndex
                          ? isNonResolved &&
                              index === 2
                            ? 'bg-red-400'
                            : 'bg-emerald-400'
                          : index === currentIndex
                            ? 'bg-primary/40'
                            : 'bg-muted-foreground/15',
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Auto-close hint */}
        {status === 'RESOLVED' && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              Clôture automatique ~10 min après résolution. Aucune action requise.
            </span>
          </div>
        )}
        {status === 'NON_RESOLVED' && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Clôture automatique ~10 min après évaluation. L'incident n'a pas été résolu.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
