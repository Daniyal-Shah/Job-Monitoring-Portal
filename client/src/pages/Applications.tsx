import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useJobFilters, useMembers } from '../lib/hooks';
import { SELECTABLE_STATUSES, STATUS_LABELS } from '../lib/constants';
import type { Application } from '../lib/types';
import { DeadlineBadge, FeeBadge, StatusBadge } from '../components/badges';
import { EmptyState, ErrorState, Input, Loading, MemberChip, PageHeader, Pagination, Select } from '../components/ui';

export default function ApplicationsPage() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) || '';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const members = useMembers();
  const filters = useJobFilters();
  const query = { q: get('q'), member: get('member'), status: get('status'), stage: get('stage'), payment: get('payment'), department: get('department'), page: get('page') || 1 };
  const { data, isLoading, error } = useQuery({
    queryKey: ['applications', query],
    queryFn: () => api.get<{ applications: Application[]; total: number; page: number; pages: number }>('/applications', query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Applications" description={data && `${data.total} application${data.total === 1 ? '' : 's'}`} />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search job title, department…" defaultValue={query.q} onChange={(e) => set('q', e.target.value)} />
        </div>
        {isAdmin && (
          <Select value={query.member} onChange={(e) => set('member', e.target.value)}>
            <option value="">All members</option>
            {members.data?.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          value={query.status || (query.stage ? `stage:${query.stage}` : '')}
          onChange={(e) => {
            const v = e.target.value;
            const next = new URLSearchParams(params);
            next.delete('status');
            next.delete('stage');
            next.delete('page');
            if (v.startsWith('stage:')) next.set('stage', v.slice(6));
            else if (v) next.set('status', v);
            setParams(next, { replace: true });
          }}
        >
          <option value="">All statuses</option>
          <option value="stage:active">In progress (open)</option>
          <option value="stage:closed">Closed</option>
          {SELECTABLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select value={query.payment} onChange={(e) => set('payment', e.target.value)}>
          <option value="">Any payment</option>
          <option value="unpaid">Unpaid</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="not_required">No fee</option>
        </Select>
        <Select value={query.department} onChange={(e) => set('department', e.target.value)}>
          <option value="">All departments</option>
          {filters.data?.departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : !data?.applications.length ? (
        <div className="card">
          <EmptyState icon={<ClipboardList className="size-5" />} title="No applications match" description="Assign jobs to family members from a job's page to create applications." />
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  {isAdmin && <th className="px-4 py-3">Member</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Fee</th>
                  <th className="px-4 py-3">Last date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.applications.map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/applications/${a._id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {a.job?.title}
                      </Link>
                      <p className="text-xs text-slate-500">{a.job?.department}</p>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <MemberChip member={a.member} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3">
                      <FeeBadge fee={a.fee} />
                    </td>
                    <td className="px-4 py-3">
                      <DeadlineBadge date={a.job?.lastDate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-slate-100 md:hidden">
              {data.applications.map((a) => (
                <li key={a._id}>
                  <Link to={`/applications/${a._id}`} className="block p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{a.job?.title}</p>
                        <p className="text-xs text-slate-500">{a.job?.department}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isAdmin && <MemberChip member={a.member} />}
                      <FeeBadge fee={a.fee} />
                      <DeadlineBadge date={a.job?.lastDate} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => set('page', String(p))} />
        </>
      )}
    </>
  );
}
