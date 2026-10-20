import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMembers } from '../lib/hooks';
import { DOCUMENT_LABELS, DOCUMENT_TYPES } from '../lib/constants';
import type { Doc } from '../lib/types';
import { DocumentList } from '../components/Documents';
import { ErrorState, Input, Loading, PageHeader, Pagination, Select } from '../components/ui';

export default function DocumentsPage() {
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
  const query = { q: get('q'), type: get('type'), member: get('member'), page: get('page') || 1 };
  const { data, isLoading, error } = useQuery({
    queryKey: ['documents', query],
    queryFn: () => api.get<{ documents: Doc[]; total: number; page: number; pages: number }>('/documents', query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Documents" description="All advertisements, challans, receipts and letters. Upload new files from a job or application page." />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search title…" defaultValue={query.q} onChange={(e) => set('q', e.target.value)} />
        </div>
        <Select value={query.type} onChange={(e) => set('type', e.target.value)}>
          <option value="">All types</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_LABELS[t]}
            </option>
          ))}
        </Select>
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
      </div>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <div className="card px-4 sm:px-5">
          <DocumentList documents={data?.documents || []} canDelete={isAdmin} showContext emptyText="No documents found" />
          {data && <Pagination page={data.page} pages={data.pages} onChange={(p) => set('page', String(p))} />}
        </div>
      )}
    </>
  );
}
