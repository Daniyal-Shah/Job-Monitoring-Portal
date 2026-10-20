import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAction, useMembers } from '../lib/hooks';
import { daysUntil, fmtDate, money, relativeDays } from '../lib/format';
import type { Application } from '../lib/types';
import { FeeBadge, feeState } from '../components/badges';
import { Button, EmptyState, ErrorState, Loading, MemberChip, PageHeader, Pagination, Select, StatCard, cx } from '../components/ui';

interface Report {
  expenses: { paid: number; unpaid: number; overdue: number; paidCount: number; unpaidCount: number; overdueCount: number };
}

export default function PaymentsPage() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const payment = params.get('payment') || '';
  const member = params.get('member') || '';
  const page = params.get('page') || '1';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const members = useMembers();
  const summary = useQuery({ queryKey: ['reports', 'payments', member], queryFn: () => api.get<Report>('/reports', { member }) });
  const list = useQuery({
    queryKey: ['applications', 'payments', payment, member, page],
    queryFn: () =>
      api.get<{ applications: Application[]; total: number; page: number; pages: number }>('/applications', {
        payment: payment || undefined,
        member,
        sort: 'due',
        page,
        includeArchived: 'true',
      }),
    placeholderData: keepPreviousData,
  });
  const markPaid = useAction((id: string) => api.patch(`/applications/${id}`, { fee: { status: 'paid' } }), 'Marked as paid');
  const e = summary.data?.expenses;
  const rows = (list.data?.applications || []).filter((a) => payment || a.fee.status !== 'not_required');

  return (
    <>
      <PageHeader
        title="Challans & fees"
        description="Track application fees, challan deadlines and receipts."
        actions={
          isAdmin && (
            <Select className="w-auto" value={member} onChange={(ev) => set('member', ev.target.value)}>
              <option value="">Everyone</option>
              {members.data?.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </Select>
          )
        }
      />
      {e && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Total spent" value={money(e.paid)} hint={`${e.paidCount} paid`} tone="green" />
          <StatCard label="Unpaid" value={money(e.unpaid)} hint={`${e.unpaidCount} challans`} tone="amber" to="/payments?payment=unpaid" />
          <StatCard label="Overdue" value={money(e.overdue)} hint={`${e.overdueCount} challans`} tone={e.overdueCount ? 'red' : 'slate'} to="/payments?payment=overdue" />
          <StatCard label="Total committed" value={money(e.paid + e.unpaid)} tone="indigo" />
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ['', 'All'],
          ['unpaid', 'Unpaid'],
          ['overdue', 'Overdue'],
          ['paid', 'Paid'],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => set('payment', v!)}
            className={cx('rounded-full px-3 py-1.5 text-sm font-medium transition', payment === v ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}
          >
            {l}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorState error={list.error} />
      ) : !rows.length ? (
        <div className="card">
          <EmptyState icon={<Receipt className="size-5" />} title="No challans here" />
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-slate-100">
            {rows.map((a) => {
              const fs = feeState(a.fee);
              return (
                <li key={a._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link to={`/applications/${a._id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 hover:text-brand-700">{a.job?.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {isAdmin && <MemberChip member={a.member} />}
                      {a.fee.challanNumber && <span>Challan {a.fee.challanNumber}</span>}
                      {fs === 'paid' ? (
                        <span>Paid {fmtDate(a.fee.paidDate)}</span>
                      ) : a.fee.dueDate ? (
                        <span className={cx(fs === 'overdue' && 'font-medium text-red-600')}>
                          Due {fmtDate(a.fee.dueDate)} ({relativeDays(daysUntil(a.fee.dueDate))})
                        </span>
                      ) : null}
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums text-slate-900">{money(a.fee.amount)}</span>
                    <FeeBadge fee={a.fee} />
                    {a.fee.status === 'unpaid' && (
                      <Button size="sm" variant="secondary" loading={markPaid.isPending && markPaid.variables === a._id} onClick={() => markPaid.mutate(a._id)}>
                        Mark paid
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {list.data && <Pagination page={list.data.page} pages={list.data.pages} onChange={(p) => set('page', String(p))} />}
        </>
      )}
    </>
  );
}
