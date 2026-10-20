import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAction } from '../lib/hooks';
import type { NotificationPrefs } from '../lib/types';
import { DEFAULT_PREFS, NotificationPrefsEditor } from '../components/NotificationPrefsEditor';
import { Button, Card, Field, Input, PageHeader } from '../components/ui';

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [prefs, setPrefs] = useState<NotificationPrefs>(user?.member?.notifications || DEFAULT_PREFS);
  useEffect(() => {
    if (user?.member?.notifications) setPrefs(user.member.notifications);
  }, [user?.member?.notifications]);

  const saveName = useAction(() => api.patch('/auth/me', { name }).then(refresh), 'Profile updated');
  const savePw = useAction(() => api.post('/auth/me/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }), 'Password changed');
  const savePrefs = useAction(() => api.patch(`/members/${user!.member!._id}`, { notifications: prefs }).then(refresh), 'Notification preferences saved');

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Profile">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveName.mutate(undefined);
              }}
            >
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Email" hint="Ask the administrator to change your login email.">
                <Input value={user?.email} disabled />
              </Field>
              <Button type="submit" loading={saveName.isPending}>
                Save
              </Button>
            </form>
          </Card>
          <Card title="Change password">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                savePw.mutate(undefined, { onSuccess: () => setPw({ currentPassword: '', newPassword: '', confirm: '' }) });
              }}
            >
              <Field label="Current password">
                <Input type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
              </Field>
              <Field label="New password" hint="At least 8 characters.">
                <Input type="password" autoComplete="new-password" minLength={8} required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
              </Field>
              <Field label="Confirm new password" error={pw.confirm && pw.confirm !== pw.newPassword ? 'Passwords do not match' : undefined}>
                <Input type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </Field>
              <Button type="submit" loading={savePw.isPending} disabled={pw.newPassword !== pw.confirm}>
                Change password
              </Button>
            </form>
          </Card>
        </div>
        {user?.member ? (
          <Card title="My email notifications" className="self-start">
            <NotificationPrefsEditor value={prefs} onChange={setPrefs} />
            <Button className="mt-5" loading={savePrefs.isPending} onClick={() => savePrefs.mutate(undefined)}>
              Save preferences
            </Button>
          </Card>
        ) : (
          <Card title="Email notifications" className="self-start">
            <p className="text-sm text-slate-600">
              Notification preferences are set per family member on the <a href="/members" className="text-brand-600 hover:underline">Family members</a> page. To receive reminders yourself, add yourself as a member too.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
