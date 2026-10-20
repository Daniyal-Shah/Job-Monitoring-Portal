import { useState } from 'react';
import { X } from 'lucide-react';
import type { NotificationPrefs } from '../lib/types';
import { Checkbox, Input, cx } from './ui';

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  newJobs: true,
  allNewJobs: false,
  deadlines: true,
  challans: true,
  events: true,
  statusChanges: true,
  reminderDays: [7, 3, 1],
};

const PRESETS = [14, 7, 5, 3, 2, 1, 0];

export function NotificationPrefsEditor({ value, onChange }: { value: NotificationPrefs; onChange: (v: NotificationPrefs) => void }) {
  const [custom, setCustom] = useState('');
  const set = <K extends keyof NotificationPrefs>(k: K, v: NotificationPrefs[K]) => onChange({ ...value, [k]: v });
  const toggleDay = (d: number) => {
    const days = value.reminderDays.includes(d) ? value.reminderDays.filter((x) => x !== d) : [...value.reminderDays, d];
    set('reminderDays', days.sort((a, b) => b - a).slice(0, 6));
  };
  const off = !value.enabled;

  return (
    <div className="space-y-4">
      <Checkbox label="Email notifications" description="Master switch for every email to this person." checked={value.enabled} onChange={(v) => set('enabled', v)} />
      <div className={cx('space-y-3 border-l-2 border-slate-100 pl-4', off && 'pointer-events-none opacity-50')}>
        <Checkbox label="New jobs assigned" checked={value.newJobs} onChange={(v) => set('newJobs', v)} disabled={off} />
        <Checkbox label="Every new job in the portal" description="Even when not assigned." checked={value.allNewJobs} onChange={(v) => set('allNewJobs', v)} disabled={off || !value.newJobs} />
        <Checkbox label="Application deadlines" description="While the application is not yet submitted." checked={value.deadlines} onChange={(v) => set('deadlines', v)} disabled={off} />
        <Checkbox label="Unpaid challan deadlines" checked={value.challans} onChange={(v) => set('challans', v)} disabled={off} />
        <Checkbox label="Tests, interviews & other events" checked={value.events} onChange={(v) => set('events', v)} disabled={off} />
        <Checkbox label="Status changes" checked={value.statusChanges} onChange={(v) => set('statusChanges', v)} disabled={off} />
        <div>
          <p className="text-sm font-medium text-slate-800">Remind me before</p>
          <p className="mb-2 text-xs text-slate-500">One email per selected day before each date. 0 = on the day.</p>
          <div className="flex flex-wrap items-center gap-2">
            {[...new Set([...PRESETS, ...value.reminderDays])]
              .sort((a, b) => b - a)
              .map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 transition',
                    value.reminderDays.includes(d) ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  {d === 0 ? 'Same day' : `${d} day${d > 1 ? 's' : ''}`}
                  {value.reminderDays.includes(d) && !PRESETS.includes(d) && <X className="size-3" />}
                </button>
              ))}
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const n = parseInt(custom, 10);
                if (n >= 0 && n <= 60 && !value.reminderDays.includes(n)) toggleDay(n);
                setCustom('');
              }}
            >
              <Input type="number" min={0} max={60} placeholder="Other" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-20 py-1 text-xs" />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
