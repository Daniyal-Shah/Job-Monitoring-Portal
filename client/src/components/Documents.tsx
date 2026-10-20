import { useRef, useState } from 'react';
import { Download, Eye, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { DOCUMENT_LABELS, DOCUMENT_TYPES, type DocumentType } from '../lib/constants';
import { fileSize, fmtDate } from '../lib/format';
import { useAction } from '../lib/hooks';
import type { Doc } from '../lib/types';
import { Button, ConfirmModal, EmptyState, Field, Input, Modal, Select, cx } from './ui';

export async function openDocument(doc: Pick<Doc, '_id'>, download = false) {
  // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
  const win = download ? null : window.open('', '_blank');
  try {
    const { url } = await api.get<{ url: string }>(`/documents/${doc._id}/access`, { download: download ? 1 : undefined });
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (err) {
    win?.close();
    toast.error((err as Error).message);
  }
}

const isImage = (d: Doc) => d.mimeType?.startsWith('image/');

export function DocumentRow({ doc, canDelete = true, showContext }: { doc: Doc; canDelete?: boolean; showContext?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const del = useAction(() => api.del(`/documents/${doc._id}`), 'Document deleted');
  const job = typeof doc.job === 'object' ? doc.job : null;
  const member = typeof doc.member === 'object' ? doc.member : null;
  return (
    <li className="flex items-center gap-3 py-3">
      <div className={cx('rounded-lg p-2', isImage(doc) ? 'bg-sky-50 text-sky-600' : 'bg-rose-50 text-rose-600')}>
        {isImage(doc) ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
      </div>
      <button className="min-w-0 flex-1 text-left" onClick={() => openDocument(doc)}>
        <p className="truncate text-sm font-medium text-slate-900 hover:text-brand-700">{doc.title}</p>
        <p className="truncate text-xs text-slate-500">
          {DOCUMENT_LABELS[doc.type]} · {fmtDate(doc.createdAt)} {doc.bytes ? `· ${fileSize(doc.bytes)}` : ''}
          {showContext && job && ` · ${job.title}`}
          {showContext && member && ` · ${member.name}`}
        </p>
      </button>
      <div className="flex shrink-0 items-center">
        <button className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => openDocument(doc)} aria-label="View">
          <Eye className="size-4" />
        </button>
        <button className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => openDocument(doc, true)} aria-label="Download">
          <Download className="size-4" />
        </button>
        {canDelete && (
          <button className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirm(true)} aria-label="Delete">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => del.mutate(undefined, { onSuccess: () => setConfirm(false) })}
        loading={del.isPending}
        title="Delete document?"
        message={`"${doc.title}" will be permanently removed from storage.`}
      />
    </li>
  );
}

export function DocumentList({ documents, canDelete, showContext, emptyText = 'No documents uploaded yet.' }: { documents: Doc[]; canDelete?: boolean; showContext?: boolean; emptyText?: string }) {
  if (!documents.length) return <EmptyState icon={<Paperclip className="size-5" />} title={emptyText} />;
  return (
    <ul className="divide-y divide-slate-100">
      {documents.map((d) => (
        <DocumentRow key={d._id} doc={d} canDelete={canDelete} showContext={showContext} />
      ))}
    </ul>
  );
}

export function UploadButton({ job, application, types = [...DOCUMENT_TYPES], defaultType }: { job?: string; application?: string; types?: DocumentType[]; defaultType?: DocumentType }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DocumentType>(defaultType || types[0]!);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useAction(
    () => {
      const fd = new FormData();
      fd.append('file', file!);
      fd.append('type', type);
      if (title.trim()) fd.append('title', title.trim());
      if (application) fd.append('application', application);
      else if (job) fd.append('job', job);
      return api.post('/documents', fd);
    },
    'Document uploaded',
  );

  const close = () => {
    setOpen(false);
    setFile(null);
    setTitle('');
  };
  const pick = (f?: File | null) => {
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  return (
    <>
      <Button size="sm" variant="secondary" icon={<Upload className="size-4" />} onClick={() => setOpen(true)}>
        Upload
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Upload document"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button disabled={!file} loading={upload.isPending} onClick={() => upload.mutate(undefined, { onSuccess: close })}>
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
              dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-slate-400',
            )}
          >
            <Upload className="mb-2 size-6 text-slate-400" />
            {file ? (
              <p className="text-sm font-medium text-slate-800">
                {file.name} <span className="font-normal text-slate-500">({fileSize(file.size)})</span>
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-800">Tap to choose a file or take a photo</p>
                <p className="text-xs text-slate-500">PDF or image, up to 15 MB</p>
              </>
            )}
            <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <Field label="Document type">
            <Select value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Paid challan – HBL" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
