import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Briefcase, CalendarClock, ClipboardList, Mic, PenLine, Plus, Receipt, Trophy } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMembers } from '../lib/hooks';
import { STATUS_LABELS, type ApplicationStatus } from '../lib/constants';
import { fmtDateTime, money } from '../lib/format';
import type { CalendarItem } from '../lib/types';
import { StatusBadge } from '../components/badges';
import { ButtonLink, Card, EmptyState, ErrorState, Loading, PageHeader, Select, StatCard } from '../components/ui';
import { UpcomingList } from './Calendar';
import { useSearchParams } from 'react-router-dom';

interface DashboardData {
  stats: Record<string, number>;
  byStatus: Partial<Record<ApplicationStatus, number>>;
  upcoming: CalendarItem[];
  recent: { _id: string; application: string; status: ApplicationStatus; note?: string; date: string; byName?: string; job?: { title: string }; member?: { name: string; color: string } }[];
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const member = params.get('member') || '';
  const members = useMembers({ activeOnly: true });
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard', member], queryFn: () => api.get<DashboardData>('/dashboard', { member }) });

  const s = data?.stats;
  return (
    <>
      <PageHeader
        title={`Assalam-o-Alaikum, ${user?.name.split(' ')[0]}`}
        description="Here's where every application stands today."
        actions={
          <>
            {isAdmin && (members.data?.length ?? 0) > 1 && (
              <Select className="w-auto" value={member} onChange={(e) => setParams(e.target.value ? { member: e.target.value } : {})}>
                <option value="">Everyone</option>
                {members.data?.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
            {isAdmin && (
              <ButtonLink to="/jobs/new" icon={<Plus className="size-4" />}>
                Add job
              </ButtonLink>
            )}
          </>
        }
      />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        s && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard label="Active jobs" value={s.totalJobs} icon={<Briefcase className="size-5" />} tone="indigo" to="/jobs" hint={`${s.totalApplications} applications`} />
              <StatCard label="In progress" value={s.inProgress} icon={<ClipboardList className="size-5" />} tone="blue" to="/applications?stage=active" hint={`${s.notApplied} not applied yet`} />
              <StatCard label="Deadlines (30 days)" value={s.upcomingDeadlines} icon={<CalendarClock className="size-5" />} tone="amber" to="/calendar" />
              <StatCard
                label="Unpaid challans"
                value={s.unpaidChallans}
                icon={<Receipt className="size-5" />}
                tone={s.overdueChallans ? 'red' : 'teal'}
                to="/payments?payment=unpaid"
                hint={s.overdueChallans ? `${s.overdueChallans} overdue · ${money(s.unpaidAmount)}` : money(s.unpaidAmount)}
              />
              <StatCard label="Upcoming tests" value={s.scheduledTests} icon={<PenLine className="size-5" />} tone="violet" to="/calendar" />
              <StatCard label="Interviews" value={s.interviews} icon={<Mic className="size-5" />} tone="indigo" to="/calendar" />
              <StatCard label="Selected" value={s.selected} icon={<Trophy className="size-5" />} tone="green" to="/applications?status=selected" />
              <StatCard label="Overdue fees" value={s.overdueChallans} icon={<AlertTriangle className="size-5" />} tone={s.overdueChallans ? 'red' : 'slate'} to="/payments?payment=overdue" />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <Card title="Coming up (next 30 days)" className="lg:col-span-3" actions={<Link to="/calendar" className="text-sm font-medium text-brand-600">Calendar →</Link>} bodyClass="p-0 sm:p-0">
                {data.upcoming.length ? <UpcomingList items={data.upcoming} /> : <EmptyState icon={<CalendarClock className="size-5" />} title="Nothing scheduled" description="Deadlines, challan due dates, tests and interviews will appear here." />}
              </Card>

              <div className="space-y-6 lg:col-span-2">
                <Card title="Applications by status">
                  {Object.keys(data.byStatus).length ? (
                    <ul className="space-y-2">
                      {Object.entries(data.byStatus)
                        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                        .map(([status, n]) => (
                          <li key={status}>
                            <Link to={`/applications?status=${status}`} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-slate-50">
                              <StatusBadge status={status as ApplicationStatus} />
                              <span className="text-sm font-semibold tabular-nums text-slate-700">{n}</span>
                            </Link>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No applications yet.</p>
                  )}
                </Card>

                <Card title="Recent updates" bodyClass="p-0 sm:p-0">
                  {data.recent.length ? (
                    <ul className="divide-y divide-slate-100">
                      {data.recent.map((r) => (
                        <li key={r._id}>
                          <Link to={`/applications/${r.application}`} className="block px-4 py-3 hover:bg-slate-50 sm:px-5">
                            <div className="flex items-center gap-2">
                              <span className="size-2 shrink-0 rounded-full" style={{ background: r.member?.color }} />
                              <p className="truncate text-sm font-medium text-slate-900">{r.job?.title}</p>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {r.member?.name} · {STATUS_LABELS[r.status]} · {fmtDateTime(r.date, 'd MMM, h:mm a')}
                              {r.note && ` · ${r.note}`}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-5 text-sm text-slate-500">No activity yet.</p>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )
      )}
    </>
  );
}
