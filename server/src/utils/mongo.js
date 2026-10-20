import mongoose from 'mongoose';

const toId = (v) => (typeof v === 'string' && mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v);

/** Aggregation pipelines do not cast strings to ObjectIds automatically. */
export function castMatch(match) {
  const out = { ...match };
  for (const k of ['member', 'job', '_id']) {
    if (typeof out[k] === 'string') out[k] = toId(out[k]);
    else if (out[k]?.$in) out[k] = { ...out[k], $in: out[k].$in.map(toId) };
  }
  return out;
}
