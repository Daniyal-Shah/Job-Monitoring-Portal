import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Pencil, Trash2, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAction, useMembers } from '../lib/hooks';
import { JOB_DOCUMENT_TYPES } from '../lib/constants';
import { fmtDate, money } from '../lib/format';
import type { Application, Doc, Job } from '../lib/types';
import { DeadlineBadge, FeeBadge, StatusBadge } from '../components/badges';
import { DocumentList, UploadButton } from '../components/Documents';
import { Badge, Button, ButtonLink, Card, Checkbox, ConfirmModal, DescriptionList, EmptyState, ErrorState, Loading, MemberChip, Modal, PageHeader } from '../components/ui';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get<{ job: Job; applications: Application[]; documents: Doc[] }>(`/jobs/${id}`),
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const archive = useAction((archived: boolean) => api.post(`/jobs/${id}/archive`, { archived }), 'Job updated');
  const remove = useAction(() => api.del(`/jobs/${id}`), 'Job deleted');

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} />;
  const { job, applications, documents } = data;
  const jobDocs = documents.filter((d) => !d.application);

  return (
    <>
      <PageHeader
        back={
          <Link to="/jobs" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> Jobs
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {job.title}
            {job.bps && <Badge tone="indigo">BPS-{job.bps}</Badge>}
            {job.archived && <Badge>Archived</Badge>}
          </span>
        }
        description={[job.department, job.organization, job.advertisementNumber && `Ad ${job.advertisementNumber}`].filter(Boolean).join(' · ')}
        actions={
          <>
            {(job.applyLink || job.officialLink) && (
              <a href={job.applyLink || job.officialLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <ExternalLink className="size-4" /> {job.applyLink ? 'Apply online' : 'Official link'}
              </a>
            )}
            {isAdmin && (
              <>
                <ButtonLink to={`/jobs/${job._id}/edit`} variant="secondary" icon={<Pencil className="size-4" />}>
                  Edit
                </ButtonLink>
                <Button variant="secondary" icon={job.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />} loading={archive.isPending} onClick={() => archive.mutate(!job.archived)}>
                  {job.archived ? 'Restore' : 'Archive'}
                </Button>
                <Button variant="ghost" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)} aria-label="Delete job" />
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details">
            <DescriptionList
              items={[
                ['Last date', <DeadlineBadge key="d" date={job.lastDate} />],
                ['Application fee', job.applicationFee ? money(job.applicationFee) : 'No fee'],
                ['Advertisement date', job.advertisementDate && fmtDate(job.advertisementDate)],
                ['Salary', job.salary],
                ['Posts', job.numberOfPosts],
                ['Location / quota', job.location],
                ['Age limit', job.ageLimit],
                ['Official link', job.officialLink && <a className="break-all text-brand-600 hover:underline" href={job.officialLink} target="_blank" rel="noreferrer">{job.officialLink}</a>],
              ]}
            />
            {(job.qualification || job.eligibility || job.notes) && (
              <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                {job.qualification && <TextBlock label="Qualification" text={job.qualification} />}
                {job.eligibility && <TextBlock label="Eligibility criteria" text={job.eligibility} />}
                {job.notes && <TextBlock label="Notes" text={job.notes} />}
              </div>
            )}
          </Card>

          <Card
            title={`Applications (${applications.length})`}
            actions={
              isAdmin && !job.archived && (
                <Button size="sm" variant="secondary" icon={<UserPlus className="size-4" />} onClick={() => setAssignOpen(true)}>
                  Assign
                </Button>
              )
            }
            bodyClass="p-0 sm:p-0"
          >
            {applications.length ? (
              <ul className="divide-y divide-slate-100">
                {applications.map((a) => (
                  <li key={a._id}>
                    <Link to={`/applications/${a._id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <MemberChip member={a.member} />
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} />
                        <FeeBadge fee={a.fee} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Not assigned yet" description="Assign this job to a family member to start tracking their application." />
            )}
          </Card>
        </div>

        <Card title="Advertisement & documents" actions={<UploadButton job={job._id} types={JOB_DOCUMENT_TYPES} />} className="self-start">
          <DocumentList documents={jobDocs} canDelete={isAdmin} emptyText="Upload the advertisement image or PDF" />
          {documents.length > jobDocs.length && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {documents.length - jobDocs.length} more document(s) are attached to individual applications.
            </p>
          )}
        </Card>
      </div>

      <AssignModal open={assignOpen} onClose={() => setAssignOpen(false)} job={job} assigned={applications.map((a) => a.member._id)} />
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this job?"
        message="This permanently deletes the job together with all its applications, events and uploaded documents. Archive it instead if you only want to hide it."
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => navigate('/jobs') })}
      />
    </>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{text}</p>
    </div>
  );
}

function AssignModal({ open, onClose, job, assigned }: { open: boolean; onClose: () => void; job: Job; assigned: string[] }) {
  const members = useMembers({ activeOnly: true });
  const [selected, setSelected] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const assign = useAction(() => api.post<{ assigned: number }>(`/jobs/${job._id}/assign`, { memberIds: selected, notify }), (r) => `Assigned to ${r.assigned} member(s)`);
  const available = members.data?.filter((m) => !assigned.includes(m._id)) || [];
  const close = () => {
    setSelected([]);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Assign job"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!selected.length} loading={assign.isPending} onClick={() => assign.mutate(undefined, { onSuccess: close })}>
            Assign
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {available.length ? (
          available.map((m) => (
            <Checkbox key={m._id} label={m.name} description={m.email} checked={selected.includes(m._id)} onChange={(v) => setSelected((s) => (v ? [...s, m._id] : s.filter((x) => x !== m._id)))} />
          ))
        ) : (
          <p className="text-sm text-slate-500">Every active member already has this job.</p>
        )}
        <hr className="border-slate-100" />
        <Checkbox label="Email them about this job" checked={notify} onChange={setNotify} />
      </div>
    </Modal>
  );
}
