import mongoose from 'mongoose';
import { APPLICATION_STATUSES, FEE_STATUSES } from '../utils/constants.js';

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    note: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: String,
  },
  { _id: true },
);

const feeSchema = new mongoose.Schema(
  {
    status: { type: String, enum: FEE_STATUSES, default: 'unpaid' },
    amount: { type: Number, min: 0, default: 0 },
    challanNumber: { type: String, trim: true },
    bank: { type: String, trim: true },
    dueDate: Date,
    paidDate: Date,
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'discovered', index: true },
    appliedDate: Date,
    applicationNumber: { type: String, trim: true },
    rollNumber: { type: String, trim: true },
    testCentre: { type: String, trim: true },
    marks: { type: String, trim: true },
    meritPosition: { type: String, trim: true },
    notes: { type: String, trim: true },
    fee: { type: feeSchema, default: () => ({}) },
    timeline: [timelineSchema],
  },
  { timestamps: true },
);

applicationSchema.index({ job: 1, member: 1 }, { unique: true });
applicationSchema.index({ 'fee.status': 1, 'fee.dueDate': 1 });

export const Application = mongoose.model('Application', applicationSchema);
