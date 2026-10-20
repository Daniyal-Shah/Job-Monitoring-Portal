import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    // Recruiting body, e.g. FPSC, PPSC, SPSC, NTS, PTS.
    organization: { type: String, trim: true },
    advertisementNumber: { type: String, trim: true },
    advertisementDate: Date,
    bps: { type: Number, min: 1, max: 22 },
    salary: { type: String, trim: true },
    numberOfPosts: { type: Number, min: 0 },
    location: { type: String, trim: true },
    qualification: { type: String, trim: true },
    eligibility: { type: String, trim: true },
    ageLimit: { type: String, trim: true },
    applicationFee: { type: Number, min: 0, default: 0 },
    lastDate: { type: Date, index: true },
    officialLink: { type: String, trim: true },
    applyLink: { type: String, trim: true },
    notes: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    archived: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

jobSchema.index({ title: 'text', department: 'text', organization: 'text', advertisementNumber: 'text' });

export const Job = mongoose.model('Job', jobSchema);
