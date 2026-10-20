import mongoose from 'mongoose';
import { DOCUMENT_TYPES } from '../utils/constants.js';

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: DOCUMENT_TYPES, default: 'other', index: true },
    // A document belongs to a job (e.g. the advertisement) and/or an application.
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', index: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    provider: { type: String, enum: ['cloudinary', 'local'], required: true },
    key: { type: String, required: true }, // Cloudinary public_id or local file name
    resourceType: String,
    format: String,
    mimeType: String,
    bytes: Number,
    originalName: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

documentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.key;
    delete ret.__v;
    return ret;
  },
});

export const Document = mongoose.model('Document', documentSchema);
