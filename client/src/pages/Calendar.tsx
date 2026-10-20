import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarClock, ChevronLeft, ChevronRight, MapPin, Receipt, PenLine } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMembers } from '../lib/hooks';
import { EVENT_LABELS } from '../lib/constants';
import { asLocalDay, daysUntil, relativeDays } from '../lib/format';
import type { CalendarItem } from '../lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, PageHeader, Select, cx } from '../components/ui';

const itemDay = (i: CalendarItem) => (i.dateOnly ? asLocalDay(i.date) : new Date(i.date));

const KIND_STYLE = {
  deadline: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800', icon: CalendarClock, label: 'Last date' },
  challan: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-800', icon: Receipt, label: 'Challan' },
  event: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-800', icon: PenLine, label: 'Event' },
} as const;

export function UpcomingList({ items }: { items: CalendarItem[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((i) => {
        const style = KIND_STYLE[i.kind];
        const Icon = style.icon;
        const d = itemDay(i);
        const days = daysUntil(i.date, i.dateOnly);
        const cancelled = i.status === 'cancelled';
        return (
          <li key={i.id}>
            <Link to={i.link} className={cx('flex items-start gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5', cancelled && 'opacity-50')}>
              <div className={cx('mt-0.5 rounded-lg p-2', style.chip)}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cx('truncate text-sm font-medium text-slate-900', cancelled && 'line-through')}>
                  {i.kind === 'event' && i.type ? `${i.title === i.type ? EVENT_LABELS[i.type] : i.title}` : i.title}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {format(d, i.dateOnly ? 'EEE d MMM' : 'EEE d MMM, h:mm a')}
                  {i.subtitle && ` · ${i.subtitle}`}
                </p>
                {i.location && (
                  <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                    <MapPin className="size-3" /> {i.location}
                  </p>
                )}
                {!!i.members.length && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {i.members.map((m) => (
                      <span key={m._id} className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <span className="size-1.5 rounded-full" style={{ background: m.color }} />
                        {m.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Badge tone={days < 0 ? 'slate' : days <= 2 ? 'red' : days <= 7 ? 'amber' : 'blue'}>{relativeDays(days)}</Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function CalendarPage() {
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(new Date());
  const [member, setMember] = useState('');
  const [kind, setKind] = useState('');
  const members = useMembers();

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart.getTime(), gridEnd.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pad the range by a day each side so date-only items stored at UTC midnight are included.
  const from = new Date(gridStart.getTime() - 86_400_000).toISOString();
  const to = new Date(gridEnd.getTime() + 2 * 86_400_000).toISOString();
  const { data, isLoading, error } = useQuery({
    queryKey: ['calendar', from, to, member],
    queryFn: () => api.get<{ items: CalendarItem[] }>('/calendar', { from, to, member }),
  });
  const items = (data?.items || []).filter((i) => !kind || i.kind === kind);
  const byDay = (d: Date) => items.filter((i) => isSameDay(itemDay(i), d));
  const selectedItems = selected ? byDay(selected) : [];

  const upcoming = useQuery({
    queryKey: ['calendar', 'upcoming', member],
    queryFn: () => api.get<{ items: CalendarItem[] }>('/calendar', { from: new Date(Date.now() - 86_400_000).toISOString(), to: new Date(Date.now() + 60 * 86_400_000).toISOString(), member }),
  });
  const upcomingItems = (upcoming.data?.items || []).filter((i) => (!kind || i.kind === kind) && daysUntil(i.date, i.dateOnly) >= 0);

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Application deadlines, challan due dates, tests and interviews."
        actions={
          <>
            {isAdmin && (
              <Select className="w-auto" value={member} onChange={(e) => setMember(e.target.value)}>
                <option value="">Everyone</option>
                {members.data?.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
            <Select className="w-auto" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All types</option>
              <option value="deadline">Deadlines</option>
              <option value="challan">Challans</option>
              <option value="event">Tests & interviews</option>
            </Select>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="font-semibold text-slate-900">{format(month, 'MMMM yyyy')}</h2>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setMonth(startOfMonth(new Date()));
                    setSelected(new Date());
                  }}
                >
                  Today
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            {error ? (
              <div className="p-4">
                <ErrorState error={error} />
              </div>
            ) : (
              <div className={cx('grid grid-cols-7', isLoading && 'opacity-60')}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="border-b border-slate-100 py-2 text-center text-xs font-medium text-slate-500">
                    {d}
                  </div>
                ))}
                {days.map((d) => {
                  const list = byDay(d);
                  const isSel = selected && isSameDay(d, selected);
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelected(d)}
                      className={cx(
                        'min-h-14 border-b border-r border-slate-100 p-1 text-left align-top transition sm:min-h-24 sm:p-1.5',
                        !isSameMonth(d, month) && 'bg-slate-50/60 text-slate-400',
                        isSel ? 'bg-brand-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <span className={cx('inline-flex size-6 items-center justify-center rounded-full text-xs font-medium', isToday(d) && 'bg-brand-600 text-white')}>{format(d, 'd')}</span>
                      <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                        {list.slice(0, 4).map((i) => (
                          <span key={i.id} className={cx('size-1.5 rounded-full', KIND_STYLE[i.kind].dot)} />
                        ))}
                      </div>
                      <div className="mt-0.5 hidden space-y-0.5 sm:block">
                        {list.slice(0, 3).map((i) => (
                          <div key={i.id} className={cx('truncate rounded px-1 py-0.5 text-[11px] font-medium', KIND_STYLE[i.kind].chip, i.status === 'cancelled' && 'line-through opacity-60')}>
                            {i.kind === 'event' && i.type ? EVENT_LABELS[i.type] : KIND_STYLE[i.kind].label}: {i.subtitle && i.kind !== 'challan' ? i.subtitle : i.title.replace(/^[^:]+: /, '')}
                          </div>
                        ))}
                        {list.length > 3 && <div className="px-1 text-[11px] text-slate-500">+{list.length - 3} more</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-4 px-4 py-3 text-xs text-slate-600">
              {Object.entries(KIND_STYLE).map(([k, s]) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className={cx('size-2 rounded-full', s.dot)} /> {k === 'event' ? 'Tests / interviews' : s.label}
                </span>
              ))}
            </div>
          </div>

          {selected && (
            <Card title={format(selected, 'EEEE, d MMMM yyyy')} className="mt-6" bodyClass="p-0 sm:p-0">
              {selectedItems.length ? <UpcomingList items={selectedItems} /> : <p className="p-5 text-sm text-slate-500">Nothing on this day.</p>}
            </Card>
          )}
        </div>

        <Card title="Upcoming (60 days)" bodyClass="p-0 sm:p-0" className="self-start">
          {upcoming.isLoading ? (
            <Loading />
          ) : upcomingItems.length ? (
            <UpcomingList items={upcomingItems} />
          ) : (
            <EmptyState icon={<CalendarClock className="size-5" />} title="Nothing coming up" />
          )}
        </Card>
      </div>
    </>
  );
}
