/**
 * File storage abstraction. Production uses Cloudinary with `type: "private"`
 * so files are never publicly reachable; access is granted through short-lived
 * signed URLs. A local-disk driver is provided for development without
 * Cloudinary credentials.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

const URL_TTL_SECONDS = 10 * 60;
const LOCAL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

if (env.STORAGE_DRIVER === 'cloudinary') {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const extFor = (file) => path.extname(file.originalname || '').toLowerCase() || (file.mimetype === 'application/pdf' ? '.pdf' : '');

const cloudinaryDriver = {
  name: 'cloudinary',
  upload(file, { folder }) {
    const isImage = file.mimetype.startsWith('image/');
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${env.CLOUDINARY_FOLDER}/${folder}`,
          type: 'private',
          // PDFs are stored as raw files so they are delivered unmodified.
          resource_type: isImage ? 'image' : 'raw',
          ...(isImage ? {} : { public_id: `${crypto.randomUUID()}${extFor(file)}` }),
        },
        (err, result) => {
          if (err) return reject(err);
          resolve({
            key: result.public_id,
            resourceType: result.resource_type,
            format: result.format || '',
            bytes: result.bytes,
          });
        },
      );
      stream.end(file.buffer);
    });
  },
  async accessUrl(doc, { download = false } = {}) {
    return cloudinary.utils.private_download_url(doc.key, doc.format || '', {
      resource_type: doc.resourceType || 'image',
      type: 'private',
      expires_at: Math.floor(Date.now() / 1000) + URL_TTL_SECONDS,
      attachment: download,
    });
  },
  async remove(doc) {
    await cloudinary.uploader.destroy(doc.key, { resource_type: doc.resourceType || 'image', type: 'private', invalidate: true });
  },
};

const sign = (id, exp) => crypto.createHmac('sha256', env.JWT_SECRET).update(`${id}.${exp}`).digest('hex');

const localDriver = {
  name: 'local',
  async upload(file) {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    const key = `${crypto.randomUUID()}${extFor(file)}`;
    await fs.writeFile(path.join(LOCAL_DIR, key), file.buffer);
    return { key, resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw', format: extFor(file).slice(1), bytes: file.size };
  },
  async accessUrl(doc, { download = false, baseUrl }) {
    const exp = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
    return `${baseUrl}/api/documents/${doc._id}/raw?exp=${exp}&sig=${sign(String(doc._id), exp)}${download ? '&download=1' : ''}`;
  },
  async remove(doc) {
    await fs.rm(path.join(LOCAL_DIR, path.basename(doc.key)), { force: true });
  },
  verify(id, exp, sig) {
    if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
    const expected = Buffer.from(sign(String(id), exp));
    const given = Buffer.from(String(sig));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  },
  filePath: (doc) => path.join(LOCAL_DIR, path.basename(doc.key)),
};

const drivers = { cloudinary: cloudinaryDriver, local: localDriver };

/** Driver used for new uploads. */
export const storage = drivers[env.STORAGE_DRIVER] || localDriver;
/** Driver that holds an existing document. */
export const driverFor = (doc) => drivers[doc.provider] || localDriver;
export { localDriver };
