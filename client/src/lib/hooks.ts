import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';
import type { Member } from './types';

export function useMembers(opts: { activeOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ['members', opts.activeOnly ?? false],
    queryFn: () => api.get<{ members: Member[] }>('/members', { active: opts.activeOnly ? 'true' : undefined }).then((r) => r.members),
    staleTime: 60_000,
  });
}

export function useJobFilters() {
  return useQuery({
    queryKey: ['jobs', 'filters'],
    queryFn: () => api.get<{ departments: string[]; organizations: string[] }>('/jobs/meta/filters'),
    staleTime: 60_000,
  });
}

/**
 * Mutation that shows a toast and refreshes all cached data on success.
 * Data sets here are small, so a broad invalidation keeps every view consistent.
 */
export function useAction<TVars, TRes = unknown>(fn: (vars: TVars) => Promise<TRes>, success?: string | ((res: TRes) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      qc.invalidateQueries();
      const msg = typeof success === 'function' ? success(res) : success;
      if (msg) toast.success(msg);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
