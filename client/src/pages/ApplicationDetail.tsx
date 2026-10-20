import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, CheckCircle2, ExternalLink, MapPin, Pencil, Receipt, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAction } from '../lib/hooks';
import { APPLICATION_STATUSES, EVENT_LABELS, FEE_STATUSES, FEE_LABELS, STATUS_LABELS, type ApplicationStatus, type FeeStatus } from '../lib/constants';
import { daysUntil, fmtDate, fmtDateTime, money, relativeDays, toDateInput } from '../lib/format';
import type { Application, Doc, RecruitmentEvent } from '../lib/types';
import { DeadlineBadge, FeeBadge, Pipeline, StatusBadge, feeState } from '../components/badges';
import { DocumentList, UploadButton } from '../components/Documents';
import { EventModal } from '../components/EventModal';
import { Badge, Button, Card, Checkbox, ConfirmModal, DescriptionList, EmptyState, ErrorState, Field, Input, Loading, MemberChip, Modal, PageHeader, Select, Textarea, cx } from '../components/ui';

type Detail = { application: Application; events: RecruitmentEvent[]; documents: Doc[] };

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['application', id], queryFn: () => api.get<Detail>(`/applications/${id}`) });
  const [modal, setModal] = useState<null | 'status' | 'details' | 'fee' | 'event' | 'delete'>(null);
  const [editEvent, setEditEvent] = useState<RecruitmentEvent | null>(null);
  const close = () => {
    setModal(null);
    setEditEvent(null);
  };

  const markPaid = useAction(() => api.patch(`/applications/${id}`, { fee: { status: 'paid' } }), 'Challan marked as paid');
  const remove = useAction(() => api.del(`/applications/${id}`), 'Application deleted');
  const delEvent = useAction((eventId: string) => api.del(`/events/${eventId}`), 'Event removed');

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} />;
  const { application: app, events, documents } = data;
  const job = app.job;
  const fee = app.fee;
  const fs = feeState(fee);

  return (
    <>
      <PageHeader
        back={
          <Link to="/applications" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> Applications
          </Link>
        }
        title={job.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <MemberChip member={app.member} />
            <Link to={`/jobs/${job._id}`} className="hover:text-brand-700">
              {job.department}
              {job.organization && ` · ${job.organization}`}
            </Link>
          </span>
        }
        actions={
          <>
            {app.status === 'discovered' && (job.applyLink || job.officialLink) && (
              <a href={job.applyLink || job.officialLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <ExternalLink className="size-4" /> Apply
              </a>
            )}
            <Button onClick={() => setModal('status')}>Update status</Button>
            {isAdmin && <Button variant="ghost" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="size-4" />} onClick={() => setModal('delete')} aria-label="Delete application" />}
          </>
        }
      />

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Current status</span>
            <StatusBadge status={app.status} />
          </div>
          {app.status === 'discovered' && <DeadlineBadge date={job.lastDate} />}
        </div>
        <Pipeline status={app.status} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Challan & fee"
            actions={
              <>
                {fee.status === 'unpaid' && (
                  <Button size="sm" variant="secondary" icon={<CheckCircle2 className="size-4" />} loading={markPaid.isPending} onClick={() => markPaid.mutate(undefined)}>
                    Mark paid
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setModal('fee')}>
                  Edit
                </Button>
              </>
            }
          >
            {fee.status === 'not_required' ? (
              <p className="text-sm text-slate-500">No application fee for this job.</p>
            ) : (
              <>
                <div className={cx('mb-4 flex items-center gap-3 rounded-lg p-3', fs === 'paid' ? 'bg-green-50' : fs === 'overdue' ? 'bg-red-50' : 'bg-amber-50')}>
                  <Receipt className={cx('size-5', fs === 'paid' ? 'text-green-600' : fs === 'overdue' ? 'text-red-600' : 'text-amber-600')} />
                  <div className="flex-1">
                    <p className="text-lg font-semibold tabular-nums text-slate-900">{money(fee.amount)}</p>
                    <p className="text-xs text-slate-600">
                      {fs === 'paid' ? `Paid on ${fmtDate(fee.paidDate)}` : fee.dueDate ? `Due ${fmtDate(fee.dueDate)} · ${relativeDays(daysUntil(fee.dueDate))}` : 'No due date set'}
                    </p>
                  </div>
                  <FeeBadge fee={fee} />
                </div>
                <DescriptionList items={[['Challan no.', fee.challanNumber], ['Bank', fee.bank], ['Notes', fee.notes]]} />
              </>
            )}
          </Card>

          <Card
            title="Tests, interviews & events"
            actions={
              <Button size="sm" variant="secondary" icon={<CalendarPlus className="size-4" />} onClick={() => setModal('event')}>
                Add
              </Button>
            }
            bodyClass="p-0 sm:p-0"
          >
            {events.length ? (
              <ul className="divide-y divide-slate-100">
                {events.map((e) => {
                  const days = daysUntil(e.date, false);
                  return (
                    <li key={e._id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <div className="w-12 shrink-0 rounded-lg border border-slate-200 text-center">
                        <p className="rounded-t-lg bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">{fmtDateTime(e.date, 'MMM')}</p>
                        <p className="py-0.5 text-lg font-semibold leading-tight text-slate-900">{fmtDateTime(e.date, 'd')}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{e.title || EVENT_LABELS[e.type]}</p>
                          {e.status !== 'scheduled' ? (
                            <Badge tone={e.status === 'cancelled' ? 'red' : e.status === 'completed' ? 'green' : 'amber'}>{e.status}</Badge>
                          ) : (
                            days >= 0 && <Badge tone={days <= 3 ? 'red' : 'blue'}>{relativeDays(days)}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {EVENT_LABELS[e.type]} · {fmtDateTime(e.date, 'EEE d MMM yyyy, h:mm a')}
                        </p>
                        {e.location && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="size-3" /> {e.location}
                          </p>
                        )}
                        {e.notes && <p className="mt-1 text-sm text-slate-600">{e.notes}</p>}
                      </div>
                      <div className="flex shrink-0">
                        <button className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit event" onClick={() => setEditEvent(e)}>
                          <Pencil className="size-4" />
                        </button>
                        <button className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete event" onClick={() => confirm('Remove this event?') && delEvent.mutate(e._id)}>
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="No events yet" description="Add written tests, interviews or document verification dates to get reminders." />
            )}
          </Card>

          <Card title="Documents" actions={<UploadButton application={app._id} defaultType="challan_form" />}>
            <DocumentList documents={documents} canDelete emptyText="Upload challans, receipts, roll number slips…" />
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title="Application details"
            actions={
              <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setModal('details')}>
                Edit
              </Button>
            }
          >
            <DescriptionList
              items={[
                ['Applied on', app.appliedDate && fmtDate(app.appliedDate)],
                ['Application / tracking no.', app.applicationNumber],
                ['Roll number', app.rollNumber],
                ['Test centre', app.testCentre],
                ['Marks / score', app.marks],
                ['Merit position', app.meritPosition],
                ['Notes', app.notes && <span className="whitespace-pre-line">{app.notes}</span>],
              ]}
            />
          </Card>

          <Card title="Timeline">
            <ol className="relative space-y-5 border-l border-slate-200 pl-5">
              {app.timeline.map((t) => (
                <li key={t._id} className="relative">
                  <span className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                  <StatusBadge status={t.status} />
                  <p className="mt-1 text-xs text-slate-500">
                    {fmtDateTime(t.date)}
                    {t.byName && ` · ${t.byName}`}
                  </p>
                  {t.note && <p className="mt-1 text-sm text-slate-700">{t.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <StatusModal open={modal === 'status'} onClose={close} app={app} />
      <DetailsModal open={modal === 'details'} onClose={close} app={app} />
      <FeeModal open={modal === 'fee'} onClose={close} app={app} />
      <EventModal open={modal === 'event' || !!editEvent} onClose={close} applicationId={app._id} event={editEvent} />
      <ConfirmModal
        open={modal === 'delete'}
        onClose={close}
        title="Delete application?"
        message="This removes the application with its events, timeline and documents. The job itself is kept."
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => navigate('/applications') })}
      />
    </>
  );
}

function StatusModal({ open, onClose, app }: { open: boolean; onClose: () => void; app: Application }) {
  const [status, setStatus] = useState<ApplicationStatus>(app.status);
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  useEffect(() => {
    if (open) {
      setStatus(app.status);
      setNote('');
    }
  }, [open, app.status]);
  const save = useAction(() => api.post(`/applications/${app._id}/status`, { status, note, notify }), 'Status updated');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update status"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)}>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" hint="Shown in the timeline, e.g. result details or instructions.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Checkbox label="Email the family member" description="Only sent if their status-change notifications are on." checked={notify} onChange={setNotify} />
      </div>
    </Modal>
  );
}

function DetailsModal({ open, onClose, app }: { open: boolean; onClose: () => void; app: Application }) {
  const init = () => ({
    appliedDate: toDateInput(app.appliedDate),
    applicationNumber: app.applicationNumber || '',
    rollNumber: app.rollNumber || '',
    testCentre: app.testCentre || '',
    marks: app.marks || '',
    meritPosition: app.meritPosition || '',
    notes: app.notes || '',
  });
  const [form, setForm] = useState(init);
  useEffect(() => {
    if (open) setForm(init());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = useAction(() => api.patch(`/applications/${app._id}`, form), 'Details saved');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Application details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Applied on">
          <Input type="date" value={form.appliedDate} onChange={set('appliedDate')} />
        </Field>
        <Field label="Application / tracking no.">
          <Input value={form.applicationNumber} onChange={set('applicationNumber')} />
        </Field>
        <Field label="Roll number">
          <Input value={form.rollNumber} onChange={set('rollNumber')} />
        </Field>
        <Field label="Test centre">
          <Input value={form.testCentre} onChange={set('testCentre')} />
        </Field>
        <Field label="Marks / score">
          <Input value={form.marks} onChange={set('marks')} />
        </Field>
        <Field label="Merit position">
          <Input value={form.meritPosition} onChange={set('meritPosition')} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
}

function FeeModal({ open, onClose, app }: { open: boolean; onClose: () => void; app: Application }) {
  const init = () => ({
    status: app.fee.status as FeeStatus,
    amount: app.fee.amount ? String(app.fee.amount) : '',
    challanNumber: app.fee.challanNumber || '',
    bank: app.fee.bank || '',
    dueDate: toDateInput(app.fee.dueDate),
    paidDate: toDateInput(app.fee.paidDate),
    notes: app.fee.notes || '',
  });
  const [form, setForm] = useState(init);
  useEffect(() => {
    if (open) setForm(init());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = useAction(() => api.patch(`/applications/${app._id}`, { fee: { ...form, paidDate: form.status === 'paid' ? form.paidDate : '' } }), 'Challan details saved');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Challan & fee"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Payment status">
          <Select value={form.status} onChange={set('status')}>
            {FEE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {FEE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount (Rs.)">
          <Input type="number" min={0} value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="Challan / PSID no.">
          <Input value={form.challanNumber} onChange={set('challanNumber')} />
        </Field>
        <Field label="Bank">
          <Input value={form.bank} onChange={set('bank')} placeholder="e.g. HBL, NBP" />
        </Field>
        <Field label="Payment deadline" hint="Reminders are sent while unpaid.">
          <Input type="date" value={form.dueDate} onChange={set('dueDate')} />
        </Field>
        <Field label="Paid on">
          <Input type="date" value={form.paidDate} onChange={set('paidDate')} disabled={form.status !== 'paid'} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
}
