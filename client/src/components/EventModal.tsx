import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EVENT_LABELS, EVENT_STATUSES, EVENT_TYPES, type EventStatus, type EventType } from '../lib/constants';
import { toDateTimeInput } from '../lib/format';
import { useAction } from '../lib/hooks';
import type { RecruitmentEvent } from '../lib/types';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';

export function EventModal({ open, onClose, applicationId, event }: { open: boolean; onClose: () => void; applicationId: string; event?: RecruitmentEvent | null }) {
  const [form, setForm] = useState({ type: 'written_test' as EventType, title: '', date: '', location: '', notes: '', status: 'scheduled' as EventStatus });

  useEffect(() => {
    if (!open) return;
    setForm(
      event
        ? { type: event.type, title: event.title || '', date: toDateTimeInput(event.date), location: event.location || '', notes: event.notes || '', status: event.status }
        : { type: 'written_test', title: '', date: '', location: '', notes: '', status: 'scheduled' },
    );
  }, [open, event]);

  const save = useAction(() => {
    const body = { ...form, title: form.title || EVENT_LABELS[form.type], date: new Date(form.date).toISOString() };
    return event ? api.patch(`/events/${event._id}`, body) : api.post('/events', { ...body, application: applicationId });
  }, event ? 'Event updated' : 'Event added');

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? 'Edit event' : 'Add test / interview / event'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!form.date} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <Select value={form.type} onChange={(e) => set('type', e.target.value as EventType)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" hint="Changing the date re-schedules reminders.">
          <Select value={form.status} onChange={(e) => set('status', e.target.value as EventStatus)}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0]!.toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" className="sm:col-span-2">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={EVENT_LABELS[form.type]} />
        </Field>
        <Field label="Date & time">
          <Input type="datetime-local" required value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Location / centre">
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. NTS Centre, Hyderabad" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Things to bring, reporting time…" />
        </Field>
      </div>
    </Modal>
  );
}
