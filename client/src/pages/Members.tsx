import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAction, useMembers } from '../lib/hooks';
import { MEMBER_COLORS } from '../lib/constants';
import { fmtDateTime, toDateInput } from '../lib/format';
import type { Member } from '../lib/types';
import { DEFAULT_PREFS, NotificationPrefsEditor } from '../components/NotificationPrefsEditor';
import { Avatar, Badge, Button, Checkbox, ConfirmModal, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Textarea, cx } from '../components/ui';

export default function MembersPage() {
  const { data: members, isLoading, error } = useMembers();
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [loginFor, setLoginFor] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const testEmail = useAction(
    (id: string) => api.post<{ status: string; simulated?: boolean; error?: string }>(`/members/${id}/test-email`),
    (r) => (r.status === 'sent' ? (r.simulated ? 'Email simulated (no RESEND_API_KEY set) — check server logs' : 'Test email sent') : `Failed: ${r.error}`),
  );
  const remove = useAction((id: string) => api.del(`/members/${id}`), 'Member removed');

  return (
    <>
      <PageHeader
        title="Family members"
        description="Each person has their own applications, documents, payments and email preferences."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Add member
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : !members?.length ? (
        <div className="card">
          <EmptyState icon={<Users className="size-5" />} title="No family members yet" description="Add your siblings to assign jobs and send them reminders." action={<Button onClick={() => setEditing('new')}>Add member</Button>} />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <li key={m._id} className={cx('card flex flex-col p-5', !m.active && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <Avatar name={m.name} color={m.color} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    {m.name} {!m.active && <Badge>Inactive</Badge>}
                  </p>
                  <p className="truncate text-sm text-slate-500">{m.email}</p>
                  {m.relation && <p className="text-xs text-slate-500">{m.relation}</p>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Link to={`/applications?member=${m._id}`}>
                  <Badge tone="indigo">{m.applicationCount || 0} applications</Badge>
                </Link>
                <Badge tone={m.notifications.enabled ? 'green' : 'slate'}>{m.notifications.enabled ? `Reminders: ${m.notifications.reminderDays.join(', ')} days` : 'Emails off'}</Badge>
                <Badge tone={m.login?.active ? 'blue' : 'slate'}>{m.login ? (m.login.active ? 'Can sign in' : 'Login disabled') : 'No login'}</Badge>
              </div>
              {m.login?.lastLoginAt && <p className="mt-2 text-xs text-slate-400">Last sign-in {fmtDateTime(m.login.lastLoginAt)}</p>}
              <div className="mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
                <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(m)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" icon={<KeyRound className="size-3.5" />} onClick={() => setLoginFor(m)}>
                  Login
                </Button>
                <Button size="sm" variant="ghost" icon={<Mail className="size-3.5" />} loading={testEmail.isPending && testEmail.variables === m._id} onClick={() => testEmail.mutate(m._id)}>
                  Test email
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:bg-red-50" icon={<Trash2 className="size-3.5" />} onClick={() => setDeleting(m)} aria-label="Delete" />
              </div>
            </li>
          ))}
        </ul>
      )}
      <MemberModal member={editing} onClose={() => setEditing(null)} />
      <LoginModal member={loginFor} onClose={() => setLoginFor(null)} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Remove ${deleting?.name}?`}
        message="Members with applications can't be deleted — mark them inactive instead."
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting._id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  );
}

function MemberModal({ member, onClose }: { member: Member | 'new' | null; onClose: () => void }) {
  const isNew = member === 'new';
  const init = () => {
    const m = member && member !== 'new' ? member : null;
    return {
      name: m?.name || '',
      email: m?.email || '',
      phone: m?.phone || '',
      relation: m?.relation || '',
      dateOfBirth: toDateInput(m?.dateOfBirth),
      qualification: m?.qualification || '',
      domicile: m?.domicile || '',
      notes: m?.notes || '',
      color: m?.color || MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)]!,
      active: m?.active ?? true,
      notifications: m?.notifications || DEFAULT_PREFS,
    };
  };
  const [form, setForm] = useState(init);
  useEffect(() => {
    if (member) setForm(init());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);
  const save = useAction(
    () => (isNew ? api.post('/members', form) : api.patch(`/members/${(member as Member)._id}`, form)),
    isNew ? 'Member added' : 'Member updated',
  );
  const set = (k: 'name' | 'email' | 'phone' | 'relation' | 'dateOfBirth' | 'qualification' | 'domicile' | 'notes') => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      open={!!member}
      onClose={onClose}
      size="lg"
      title={isNew ? 'Add family member' : 'Edit family member'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!form.name || !form.email} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name *">
            <Input value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Email *" hint="Reminders are sent here.">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={set('phone')} placeholder="03xx-xxxxxxx" />
          </Field>
          <Field label="Relation">
            <Input value={form.relation} onChange={set('relation')} placeholder="e.g. Brother" />
          </Field>
          <Field label="Date of birth" hint="Helps check age limits.">
            <Input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
          </Field>
          <Field label="Domicile">
            <Input value={form.domicile} onChange={set('domicile')} placeholder="e.g. Hyderabad (Sindh Urban)" />
          </Field>
          <Field label="Qualification" className="sm:col-span-2">
            <Input value={form.qualification} onChange={set('qualification')} placeholder="e.g. BS Computer Science (2024)" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={set('notes')} />
          </Field>
          <div>
            <span className="label">Colour</span>
            <div className="flex flex-wrap gap-2">
              {MEMBER_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={cx('size-7 rounded-full ring-offset-2 transition', form.color === c && 'ring-2 ring-slate-900')}
                  style={{ background: c }}
                  aria-label={`Colour ${c}`}
                />
              ))}
            </div>
          </div>
          {!isNew && (
            <div className="flex items-end">
              <Checkbox label="Active" description="Inactive members get no emails." checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 pt-5">
          <p className="mb-3 text-sm font-semibold text-slate-900">Email notifications</p>
          <NotificationPrefsEditor value={form.notifications} onChange={(notifications) => setForm((f) => ({ ...f, notifications }))} />
        </div>
      </div>
    </Modal>
  );
}

function LoginModal({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (member) {
      setEmail(member.login?.email || member.email);
      setPassword('');
      setActive(member.login?.active ?? true);
    }
  }, [member]);
  const save = useAction(() => api.put(`/members/${member!._id}/login`, { email, password: password || undefined, active }), 'Login saved');
  const remove = useAction(() => api.del(`/members/${member!._id}/login`), 'Login removed');
  const hasLogin = !!member?.login;
  return (
    <Modal
      open={!!member}
      onClose={onClose}
      title={`Sign-in for ${member?.name}`}
      footer={
        <>
          {hasLogin && (
            <Button variant="ghost" className="mr-auto text-red-600" loading={remove.isPending} onClick={() => remove.mutate(undefined, { onSuccess: onClose })}>
              Remove login
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => {
              if (!hasLogin && password.length < 8) return toast.error('Password must be at least 8 characters');
              save.mutate(undefined, { onSuccess: onClose });
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Family members can sign in to see only their own jobs, applications, documents and payments.</p>
        <Field label="Login email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={hasLogin ? 'New password (leave blank to keep)' : 'Password'} hint="At least 8 characters. Share it with them privately.">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Checkbox label="Login enabled" checked={active} onChange={setActive} />
      </div>
    </Modal>
  );
}
