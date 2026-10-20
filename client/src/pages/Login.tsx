import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { User } from '../lib/types';
import { Button, Field, Input, Loading } from '../components/ui';

export default function LoginPage() {
  const { signIn } = useAuth();
  const status = useQuery({ queryKey: ['auth-status'], queryFn: () => api.get<{ needsSetup: boolean }>('/auth/status') });
  const setup = status.data?.needsSetup;
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ token: string; user: User }>(setup ? '/auth/setup' : '/auth/login', setup ? form : { email: form.email, password: form.password });
      signIn(res.token, res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <Briefcase className="size-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Job Application Portal</h1>
          <p className="mt-1 text-sm text-slate-500">{setup ? 'Create the administrator account to get started' : 'Sign in to track applications'}</p>
        </div>
        {status.isLoading ? (
          <Loading />
        ) : status.isError ? (
          <div className="card p-5 text-center text-sm text-red-600">Cannot reach the server. Make sure the backend is running.</div>
        ) : (
          <form onSubmit={submit} className="card space-y-4 p-6">
            {setup && (
              <Field label="Your name">
                <Input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" required autoComplete="email" autoFocus={!setup} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Password" hint={setup ? 'At least 8 characters' : undefined}>
              <Input
                type="password"
                required
                minLength={setup ? 8 : undefined}
                autoComplete={setup ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" loading={busy}>
              {setup ? 'Create account' : 'Sign in'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
