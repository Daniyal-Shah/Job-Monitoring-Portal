import { CalendarClock } from 'lucide-react';
import { FEE_LABELS, PIPELINE, STATUS_LABELS, STATUS_TONE, type ApplicationStatus } from '../lib/constants';
import { daysUntil, fmtDate, relativeDays } from '../lib/format';
import type { Fee } from '../lib/types';
import { Badge, cx } from './ui';

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function feeState(fee?: Fee): 'not_required' | 'unpaid' | 'paid' | 'overdue' {
  if (!fee) return 'not_required';
  if (fee.status === 'unpaid' && fee.dueDate && daysUntil(fee.dueDate) < 0) return 'overdue';
  return fee.status;
}

export function FeeBadge({ fee }: { fee?: Fee }) {
  const s = feeState(fee);
  const tone = s === 'paid' ? 'green' : s === 'overdue' ? 'red' : s === 'unpaid' ? 'amber' : 'slate';
  return <Badge tone={tone}>{FEE_LABELS[s]}</Badge>;
}

export function DeadlineBadge({ date, closedLabel = 'Closed' }: { date?: string | null; closedLabel?: string }) {
  if (!date) return <span className="text-sm text-slate-400">No deadline</span>;
  const days = daysUntil(date);
  const tone = days < 0 ? 'slate' : days <= 3 ? 'red' : days <= 7 ? 'amber' : 'blue';
  return (
    <Badge tone={tone}>
      <CalendarClock className="size-3" />
      {days < 0 ? `${closedLabel} · ${fmtDate(date, 'd MMM')}` : `${relativeDays(days)} · ${fmtDate(date, 'd MMM')}`}
    </Badge>
  );
}

const CHALLAN_STAGE = PIPELINE.findIndex((s) => s.statuses.includes('challan_paid'));

/**
 * Compact pipeline progress indicator. The "Challan paid" step follows the fee
 * rather than the status alone: an "Applied" application whose fee is paid has
 * completed it, and an unpaid fee shows it as pending (amber).
 */
export function Pipeline({ status, fee }: { status: ApplicationStatus; fee?: Fee }) {
  let idx = PIPELINE.findIndex((s) => s.statuses.includes(status));
  const failed = ['not_eligible', 'test_failed', 'not_selected', 'withdrawn'].includes(status);
  const feeSettled = !fee || fee.status !== 'unpaid';
  if (!failed && idx === CHALLAN_STAGE - 1 && feeSettled) idx = CHALLAN_STAGE;
  const challanPending = !feeSettled && idx >= CHALLAN_STAGE - 1 && !failed;

  const barColor = (i: number) => {
    if (i === CHALLAN_STAGE && challanPending) return 'bg-amber-400';
    if (i < idx) return 'bg-brand-500';
    if (i === idx) return failed ? 'bg-red-500' : status === 'selected' ? 'bg-green-500' : 'bg-brand-500';
    return 'bg-slate-200';
  };
  const label = (i: number, text: string) => (i === CHALLAN_STAGE && challanPending ? 'Challan pending' : i === CHALLAN_STAGE && fee?.status === 'not_required' ? 'No fee' : text);

  return (
    <div>
      <div className="flex gap-1">
        {PIPELINE.map((s, i) => (
          <div key={s.label} className={cx('h-1.5 flex-1 rounded-full', barColor(i))} />
        ))}
      </div>
      <div className="mt-1.5 hidden justify-between text-[11px] text-slate-500 sm:flex">
        {PIPELINE.map((s, i) => (
          <span key={s.label} className={cx(i === idx && 'font-semibold text-slate-800', i === CHALLAN_STAGE && challanPending && 'font-semibold text-amber-700')}>
            {label(i, s.label)}
          </span>
        ))}
      </div>
      {challanPending && <p className="mt-2 text-xs font-medium text-amber-700 sm:hidden">Challan pending</p>}
    </div>
  );
}
