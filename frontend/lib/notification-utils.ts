import type { Lang } from '@/lib/i18n';

/**
 * Regex to parse the raw backend notification message.
 *
 * Format with actor:
 *   "Incident {ref} transitioned from {old} to {new} by {actor}."
 *
 * Format without actor (system-generated):
 *   "Incident {ref} transitioned from {old} to {new} automatically by the system."
 */
const MESSAGE_PARSE_RE =
  /^Incident\s+(.+?)\s+transitioned from\s+(.+?)\s+to\s+(.+?)\s+(?:by\s+(.+?)|automatically by the system)\.\s*$/;

interface ParsedMessage {
  reference: string;
  oldStatus: string;
  newStatus: string;
  actor: string | null;
}

function parseRawMessage(message: string): ParsedMessage | null {
  const match = message.match(MESSAGE_PARSE_RE);
  if (!match) return null;
  return {
    reference: match[1],
    oldStatus: match[2],
    newStatus: match[3],
    actor: match[4] ?? null,
  };
}

/** Fallback: convert SCREAMING_SNAKE_CASE to Title Case. */
function humanizeStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Transform a raw backend notification message into a user-friendly,
 * localized message.
 *
 * - When oldStatus !== newStatus → shows the transition with localized labels.
 * - When oldStatus === newStatus → avoids the redundant transition text.
 * - Falls back to the raw message when parsing fails.
 */
export function formatNotificationMessage(
  rawMessage: string,
  lang: Lang,
  t: Record<string, string>,
): string {
  const parsed = parseRawMessage(rawMessage);
  if (!parsed) return rawMessage;

  const { reference, oldStatus, newStatus, actor } = parsed;
  const oldLabel = t[`status_${oldStatus}`] ?? humanizeStatus(oldStatus);
  const newLabel = t[`status_${newStatus}`] ?? humanizeStatus(newStatus);

  // Same status — avoid redundant "DECLARED to DECLARED" transitions
  if (oldStatus === newStatus) {
    if (actor) {
      return (t.notifMsgUpdated ?? 'Incident {reference} was updated by {actor}.')
        .replace('{reference}', reference)
        .replace('{actor}', actor);
    }
    return (
      (t.notifMsgUpdatedNoActor ?? 'Incident {reference} status is now {status}.')
        .replace('{reference}', reference)
        .replace('{status}', newLabel)
    );
  }

  // Different statuses — show the transition
  const template =
    t.notifMsgStatusChanged ??
    'Incident {reference} status changed from {oldStatus} to {newStatus} by {actor}.';
  return template
    .replace('{reference}', reference)
    .replace('{oldStatus}', oldLabel)
    .replace('{newStatus}', newLabel)
    .replace('{actor}', actor ?? 'the system');
}
