import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Briefcase, Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useJobFilters, useMembers } from '../lib/hooks';
import { money } from '../lib/format';
import type { Job } from '../lib/types';
import { DeadlineBadge, StatusBadge } from '../components/badges';
import { Badge, ButtonLink, EmptyState, ErrorState, Input, Loading, PageHeader, Pagination, Select } from '../components/ui';

export default function JobsPage() {
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
  const filters = useJobFilters();
  const members = useMembers();
  const query = { q: get('q'), department: get('department'), organization: get('organization'), deadline: get('deadline'), archived: get('archived'), member: get('member'), sort: get('sort') || 'deadline', page: get('page') || 1 };
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['jobs', query],
    queryFn: () => api.get<{ jobs: Job[]; total: number; page: number; pages: number }>('/jobs', query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Jobs"
        description={data ? `${data.total} job${data.total === 1 ? '' : 's'}${isFetching ? ' · updating…' : ''}` : undefined}
        actions={
          isAdmin && (
            <ButtonLink to="/jobs/new" icon={<Plus className="size-4" />}>
              Add job
            </ButtonLink>
          )
        }
      />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search title, department, ad no…" defaultValue={query.q} onChange={(e) => set('q', e.target.value)} />
        </div>
        <Select value={query.department} onChange={(e) => set('department', e.target.value)}>
          <option value="">All departments</option>
          {filters.data?.departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
        <Select value={query.deadline} onChange={(e) => set('deadline', e.target.value)}>
          <option value="">Any deadline</option>
          <option value="week">Closing within 7 days</option>
          <option value="upcoming">Still open</option>
          <option value="passed">Deadline passed</option>
        </Select>
        {isAdmin ? (
          <Select value={query.member} onChange={(e) => set('member', e.target.value)}>
            <option value="">All members</option>
            {members.data?.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </Select>
        ) : (
          <Select value={query.organization} onChange={(e) => set('organization', e.target.value)}>
            <option value="">All organizations</option>
            {filters.data?.organizations.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        )}
        <div className="flex gap-2">
          <Select value={query.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
            <option value="deadline">By deadline</option>
            <option value="newest">Newest</option>
            <option value="title">A–Z</option>
          </Select>
          <Select value={query.archived} onChange={(e) => set('archived', e.target.value)} aria-label="Archived">
            <option value="">Active</option>
            <option value="true">Archived</option>
            <option value="all">All</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : !data?.jobs.length ? (
        <div className="card">
          <EmptyState
            icon={<Briefcase className="size-5" />}
            title="No jobs found"
            description={isAdmin ? 'Add a job advertisement to start tracking applications.' : 'No jobs have been assigned to you yet.'}
            action={isAdmin && <ButtonLink to="/jobs/new">Add job</ButtonLink>}
          />
        </div>
      ) : (
        <>
          <ul className="grid gap-3">
            {data.jobs.map((job) => (
              <li key={job._id}>
                <Link to={`/jobs/${job._id}`} className="card block p-4 transition hover:border-brand-200 hover:shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{job.title}</h3>
                        {job.bps && <Badge tone="indigo">BPS-{job.bps}</Badge>}
                        {job.archived && <Badge>Archived</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {job.department}
                        {job.organization && ` · ${job.organization}`}
                        {job.advertisementNumber && ` · Ad ${job.advertisementNumber}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.applicationFee ? `Fee ${money(job.applicationFee)}` : 'No fee'}
                        {job.numberOfPosts ? ` · ${job.numberOfPosts} posts` : ''}
                        {job.location ? ` · ${job.location}` : ''}
                      </p>
                    </div>
                    <DeadlineBadge date={job.lastDate} />
                  </div>
                  {!!job.applications?.length && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      {job.applications.map((a) => (
                        <span key={a._id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 py-0.5 pl-2 pr-0.5 text-xs text-slate-700">
                          <span className="size-2 rounded-full" style={{ background: a.member.color }} />
                          {a.member.name}
                          <StatusBadge status={a.status} />
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => set('page', String(p))} />
        </>
      )}
    </>
  );
}
