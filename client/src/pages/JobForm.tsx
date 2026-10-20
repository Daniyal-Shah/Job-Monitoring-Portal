import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAction, useJobFilters, useMembers } from '../lib/hooks';
import { toDateInput } from '../lib/format';
import type { Job } from '../lib/types';
import { Button, Card, Checkbox, ErrorState, Field, Input, Loading, PageHeader, Textarea } from '../components/ui';

const EMPTY = {
  title: '', department: '', organization: '', advertisementNumber: '', advertisementDate: '', bps: '', salary: '', numberOfPosts: '',
  location: '', qualification: '', eligibility: '', ageLimit: '', applicationFee: '', lastDate: '', officialLink: '', applyLink: '', notes: '',
};
type Form = typeof EMPTY;

const fromJob = (j: Job): Form => ({
  title: j.title, department: j.department, organization: j.organization || '', advertisementNumber: j.advertisementNumber || '',
  advertisementDate: toDateInput(j.advertisementDate), bps: j.bps?.toString() || '', salary: j.salary || '', numberOfPosts: j.numberOfPosts?.toString() || '',
  location: j.location || '', qualification: j.qualification || '', eligibility: j.eligibility || '', ageLimit: j.ageLimit || '',
  applicationFee: j.applicationFee ? String(j.applicationFee) : '', lastDate: toDateInput(j.lastDate), officialLink: j.officialLink || '',
  applyLink: j.applyLink || '', notes: j.notes || '',
});

export default function JobFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const existing = useQuery({ queryKey: ['job', id], queryFn: () => api.get<{ job: Job }>(`/jobs/${id}`), enabled: editing });
  const members = useMembers({ activeOnly: true });
  const filters = useJobFilters();
  const [form, setForm] = useState<Form>(EMPTY);
  const [assignTo, setAssignTo] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [adFile, setAdFile] = useState<File | null>(null);

  useEffect(() => {
    if (existing.data) setForm(fromJob(existing.data.job));
  }, [existing.data]);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useAction(async () => {
    const body = { ...form, tags: undefined };
    if (editing) {
      await api.patch(`/jobs/${id}`, body);
      return id!;
    }
    const { job } = await api.post<{ job: Job }>('/jobs', { ...body, assignTo, notify });
    if (adFile) {
      const fd = new FormData();
      fd.append('file', adFile);
      fd.append('job', job._id);
      fd.append('type', adFile.type === 'application/pdf' ? 'advertisement_pdf' : 'advertisement_image');
      fd.append('title', `Advertisement – ${job.title}`);
      await api.post('/documents', fd).catch((err) => toast.error(`Job saved, but upload failed: ${err.message}`));
    }
    return job._id;
  }, editing ? 'Job updated' : 'Job added');

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(undefined, { onSuccess: (jobId) => navigate(`/jobs/${jobId}`) });
  }

  if (editing && existing.isLoading) return <Loading />;
  if (existing.error) return <ErrorState error={existing.error} />;

  return (
    <form onSubmit={submit}>
      <PageHeader
        back={
          <Link to={editing ? `/jobs/${id}` : '/jobs'} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> Back
          </Link>
        }
        title={editing ? 'Edit job' : 'Add job advertisement'}
        actions={
          <Button type="submit" loading={save.isPending}>
            {editing ? 'Save changes' : 'Add job'}
          </Button>
        }
      />
      <datalist id="departments">{filters.data?.departments.map((d) => <option key={d} value={d} />)}</datalist>
      <datalist id="organizations">
        {[...new Set([...(filters.data?.organizations || []), 'FPSC', 'PPSC', 'SPSC', 'KPPSC', 'BPSC', 'NTS', 'PTS', 'OTS', 'ETEA', 'Sindh Testing Service'])].map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Advertisement">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title *" className="sm:col-span-2">
                <Input required value={form.title} onChange={set('title')} placeholder="e.g. Assistant Sub-Inspector" />
              </Field>
              <Field label="Department *">
                <Input required list="departments" value={form.department} onChange={set('department')} placeholder="e.g. Sindh Police" />
              </Field>
              <Field label="Recruiting body" hint="FPSC, SPSC, NTS…">
                <Input list="organizations" value={form.organization} onChange={set('organization')} />
              </Field>
              <Field label="Advertisement no.">
                <Input value={form.advertisementNumber} onChange={set('advertisementNumber')} placeholder="e.g. 05/2026" />
              </Field>
              <Field label="Advertisement date">
                <Input type="date" value={form.advertisementDate} onChange={set('advertisementDate')} />
              </Field>
              <Field label="BPS / Scale">
                <Input type="number" min={1} max={22} value={form.bps} onChange={set('bps')} />
              </Field>
              <Field label="Salary">
                <Input value={form.salary} onChange={set('salary')} placeholder="e.g. Rs. 45,000–120,000" />
              </Field>
              <Field label="Number of posts">
                <Input type="number" min={0} value={form.numberOfPosts} onChange={set('numberOfPosts')} />
              </Field>
              <Field label="Location / quota">
                <Input value={form.location} onChange={set('location')} placeholder="e.g. Karachi, Sindh (Urban)" />
              </Field>
            </div>
          </Card>
          <Card title="Eligibility">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Qualification" className="sm:col-span-2">
                <Textarea value={form.qualification} onChange={set('qualification')} placeholder="e.g. Bachelor's degree (16 years) from HEC-recognized university" />
              </Field>
              <Field label="Age limit">
                <Input value={form.ageLimit} onChange={set('ageLimit')} placeholder="e.g. 21–30 years (+5 general relaxation)" />
              </Field>
              <Field label="Other criteria" className="sm:col-span-2">
                <Textarea rows={4} value={form.eligibility} onChange={set('eligibility')} placeholder="Domicile, experience, physical standards…" />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea value={form.notes} onChange={set('notes')} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Dates & fee">
            <div className="space-y-4">
              <Field label="Last date to apply">
                <Input type="date" value={form.lastDate} onChange={set('lastDate')} />
              </Field>
              <Field label="Application fee (Rs.)" hint="Used as the default challan amount.">
                <Input type="number" min={0} value={form.applicationFee} onChange={set('applicationFee')} />
              </Field>
              <Field label="Official advertisement link">
                <Input type="url" value={form.officialLink} onChange={set('officialLink')} placeholder="https://" />
              </Field>
              <Field label="Online application link">
                <Input type="url" value={form.applyLink} onChange={set('applyLink')} placeholder="https://" />
              </Field>
            </div>
          </Card>

          {!editing && (
            <Card title="Assign & notify">
              <div className="space-y-3">
                {members.data?.length ? (
                  members.data.map((m) => (
                    <Checkbox
                      key={m._id}
                      label={m.name}
                      description={m.email}
                      checked={assignTo.includes(m._id)}
                      onChange={(v) => setAssignTo((a) => (v ? [...a, m._id] : a.filter((x) => x !== m._id)))}
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Add <Link to="/members" className="text-brand-600">family members</Link> to assign jobs.
                  </p>
                )}
                <hr className="border-slate-100" />
                <Checkbox label="Send new-job email" description="To assigned members (and anyone subscribed to all jobs)." checked={notify} onChange={setNotify} />
                <Field label="Advertisement file (optional)" hint="Photo or PDF of the advertisement.">
                  <Input type="file" accept="image/*,application/pdf" onChange={(e) => setAdFile(e.target.files?.[0] || null)} className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-sm" />
                </Field>
              </div>
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}
