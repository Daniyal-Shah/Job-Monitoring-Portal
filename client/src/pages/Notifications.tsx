import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Bell, Play } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAction, useMembers } from '../lib/hooks';
import { NOTIFICATION_LABELS } from '../lib/constants';
import { fmtDateTime } from '../lib/format';
import type { NotificationLog } from '../lib/types';
import { Badge, Button, EmptyState, ErrorState, Loading, MemberChip, PageHeader, Pagination, Select } from '../components/ui';

interface Resp {
  notifications: NotificationLog[];
  total: number;
  page: number;
  pages: number;
  counts: Record<string, number>;
  config: { emailEnabled: boolean; schedulerEnabled: boolean; cron: string; timezone: string };
}

export default function NotificationsPage() {
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
  const query = { status: get('status'), kind: get('kind'), member: get('member'), page: get('page') || 1 };
  const { data, isLoading, error } = useQuery({ queryKey: ['notifications', query], queryFn: () => api.get<Resp>('/notifications', query), placeholderData: keepPreviousData });
  const run = useAction(
    () => api.post<{ result: { sent?: number; failed?: number; skipped?: boolean; reason?: string } }>('/notifications/run-reminders'),
    ({ result }) => (result.skipped ? result.reason! : `Reminder check done: ${result.sent || 0} sent, ${result.failed || 0} failed`),
  );

  return (
    <>
      <PageHeader
        title="Notifications"
        description="History of every email sent by the portal."
        actions={
          isAdmin && (
            <Button variant="secondary" icon={<Play className="size-4" />} loading={run.isPending} onClick={() => run.mutate(undefined)}>
              Run reminders now
            </Button>
          )
        }
      />
      {data?.config && isAdmin && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Badge tone={data.config.emailEnabled ? 'green' : 'amber'}>{data.config.emailEnabled ? 'Resend connected' : 'Email simulated (set RESEND_API_KEY)'}</Badge>
          <Badge tone={data.config.schedulerEnabled ? 'green' : 'slate'}>{data.config.schedulerEnabled ? `Scheduler: ${data.config.cron} (${data.config.timezone})` : 'Scheduler off'}</Badge>
          <Badge tone="green">{data.counts.sent || 0} sent</Badge>
          <Badge tone={data.counts.failed ? 'red' : 'slate'}>{data.counts.failed || 0} failed</Badge>
        </div>
      )}
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-3">
        <Select value={query.kind} onChange={(e) => set('kind', e.target.value)}>
          <option value="">All types</option>
          {Object.entries(NOTIFICATION_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Select value={query.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Any result</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
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
      ) : !data?.notifications.length ? (
        <div className="card">
          <EmptyState icon={<Bell className="size-5" />} title="No emails yet" description="Reminders are checked automatically; sent and failed emails will be listed here." />
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-slate-100">
            {data.notifications.map((n) => (
              <li key={n._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{n.subject}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <MemberChip member={n.member} />
                    <span>{n.email}</span>
                    <span>{fmtDateTime(n.sentAt || n.createdAt)}</span>
                  </div>
                  {n.error && <p className="mt-1 text-xs text-red-600">{n.error}</p>}
                </div>
                <div className="flex gap-2">
                  <Badge>{NOTIFICATION_LABELS[n.kind] || n.kind}</Badge>
                  <Badge tone={n.status === 'sent' ? (n.simulated ? 'amber' : 'green') : n.status === 'failed' ? 'red' : 'slate'}>
                    {n.status === 'sent' && n.simulated ? 'simulated' : n.status}
                    {n.attempts > 1 && ` ×${n.attempts}`}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => set('page', String(p))} />
        </>
      )}
    </>
  );
}
