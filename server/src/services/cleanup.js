import { Application, Document, Event, Notification } from '../models/index.js';
import { driverFor } from './storage.js';

export async function deleteDocuments(filter) {
  const docs = await Document.find(filter);
  await Promise.allSettled(docs.map((d) => driverFor(d).remove(d)));
  await Document.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
}

export async function deleteApplications(filter) {
  const ids = (await Application.find(filter).select('_id').lean()).map((a) => a._id);
  if (!ids.length) return;
  await deleteDocuments({ application: { $in: ids } });
  await Event.deleteMany({ application: { $in: ids } });
  await Notification.updateMany({ application: { $in: ids } }, { $unset: { application: 1, event: 1 } });
  await Application.deleteMany({ _id: { $in: ids } });
}
