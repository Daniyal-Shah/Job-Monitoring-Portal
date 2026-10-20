import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMembers } from '../lib/hooks';
import { STATUS_LABELS, type ApplicationStatus } from '../lib/constants';
import { fmtDate, money } from '../lib/format';
import type { Application, CalendarItem, MemberRef } from '../lib/types';
import { feeState } from '../components/badges';
import { Button, Card, ErrorState, Loading, MemberChip, PageHeader, Select, StatCard } from '../components/ui';
import { UpcomingList } from './Calendar';
import { useState } from 'react';

interface ReportData {
  byStatus: { status: ApplicationStatus; count: number }[];
  byMember: { _id: string; member?: MemberRef; total: number; active: number; selected: number; paid: number; unpaid: number }[];
  byDepartment: { department: string; count: number; paid: number }[];
  expenses: { paid: number; unpaid: number; overdue: number; paidCount: number; unpaidCount: number; overdueCount: number };
  monthly: { month: string; amount: number; count: number }[];
  payments: Application[];
  upcoming: CalendarItem[];
}

/** Single-series horizontal magnitude bars; values are always printed in text ink. */
function BarList({ rows }: { rows: { label: string; value: number; display?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-slate-500">No data yet.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.display ?? r.value}`} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-slate-600">{r.label}</span>
          <span className="h-2.5 rounded-r bg-slate-100">
            <span className="block h-full rounded-r bg-brand-600" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </span>
          <span className="text-right font-medium tabular-nums text-slate-800">{r.display ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function MonthlyBars({ data }: { data: ReportData['monthly'] }) {
  if (!data.length) return <p className="text-sm text-slate-500">No fees paid in the last 12 months.</p>;
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="flex h-44 items-end gap-1.5 border-b border-slate-200 pt-4">
      {data.map((d) => (
        <div key={d.month} className="group relative flex h-full flex-1 flex-col justify-end" title={`${format(parseISO(`${d.month}-01`), 'MMM yyyy')}: ${money(d.amount)} (${d.count} challans)`}>
          <span className="mb-1 hidden text-center text-[10px] font-medium tabular-nums text-slate-700 group-hover:block">{money(d.amount)}</span>
          <span className="block rounded-t bg-brand-600 group-hover:bg-brand-700" style={{ height: `${Math.max(3, (d.amount / max) * 85)}%` }} />
          <span className="absolute -bottom-5 left-0 right-0 text-center text-[10px] text-slate-500">{format(parseISO(`${d.month}-01`), 'MMM')}</span>
        </div>
      ))}
    </div>
  );
}

function downloadCsv(payments: Application[]) {
  const header = ['Member', 'Job', 'Department', 'Status', 'Amount', 'Challan no', 'Bank', 'Due date', 'Paid date', 'Payment status'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = payments.map((a) =>
    [a.member?.name, a.job?.title, a.job?.department, STATUS_LABELS[a.status], a.fee.amount, a.fee.challanNumber, a.fee.bank, a.fee.dueDate ? fmtDate(a.fee.dueDate) : '', a.fee.paidDate ? fmtDate(a.fee.paidDate) : '', feeState(a.fee)]
      .map(esc)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const [member, setMember] = useState('');
  const members = useMembers();
  const { data, isLoading, error } = useQuery({ queryKey: ['reports', member], queryFn: () => api.get<ReportData>('/reports', { member }) });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Application progress, expenses and upcoming events."
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
            <Button variant="secondary" icon={<Download className="size-4" />} disabled={!data?.payments.length} onClick={() => data && downloadCsv(data.payments)}>
              Export expenses CSV
            </Button>
          </>
        }
      />
      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState error={error} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Applications" value={data.byStatus.reduce((n, s) => n + s.count, 0)} tone="indigo" />
            <StatCard label="Fees paid" value={money(data.expenses.paid)} hint={`${data.expenses.paidCount} challans`} tone="green" />
            <StatCard label="Fees unpaid" value={money(data.expenses.unpaid)} hint={`${data.expenses.unpaidCount} challans`} tone="amber" />
            <StatCard label="Overdue" value={money(data.expenses.overdue)} hint={`${data.expenses.overdueCount} challans`} tone={data.expenses.overdueCount ? 'red' : 'slate'} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Applications by status">
              <BarList rows={data.byStatus.map((s) => ({ label: STATUS_LABELS[s.status], value: s.count }))} />
            </Card>
            <Card title="Fees paid per month (last 12 months)">
              <div className="pb-5">
                <MonthlyBars data={data.monthly} />
              </div>
            </Card>
          </div>

          {isAdmin && !member && (
            <Card title="Progress by family member" bodyClass="p-0 sm:p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3 text-right">Applications</th>
                      <th className="px-4 py-3 text-right">Open</th>
                      <th className="px-4 py-3 text-right">Selected</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Unpaid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {data.byMember.map((m) => (
                      <tr key={m._id}>
                        <td className="px-4 py-3">
                          <MemberChip member={m.member} />
                        </td>
                        <td className="px-4 py-3 text-right">{m.total}</td>
                        <td className="px-4 py-3 text-right">{m.active}</td>
                        <td className="px-4 py-3 text-right">{m.selected}</td>
                        <td className="px-4 py-3 text-right">{money(m.paid)}</td>
                        <td className="px-4 py-3 text-right">{money(m.unpaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Applications by department">
              <BarList rows={data.byDepartment.map((d) => ({ label: d.department, value: d.count }))} />
            </Card>
            <Card title="Upcoming events (60 days)" bodyClass="p-0 sm:p-0">
              {data.upcoming.length ? <UpcomingList items={data.upcoming} /> : <p className="p-5 text-sm text-slate-500">Nothing scheduled.</p>}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
