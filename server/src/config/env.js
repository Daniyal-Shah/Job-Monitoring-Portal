const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

const clientUrls = list(process.env.CLIENT_URL || 'http://localhost:5173');

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 4000),
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URLS: clientUrls,
  // Public URL of the frontend, used for links inside emails.
  APP_URL: (process.env.APP_URL || clientUrls[0]).replace(/\/$/, ''),
  APP_NAME: process.env.APP_NAME || 'Job Application Portal',
  APP_TIMEZONE: process.env.APP_TIMEZONE || 'Asia/Karachi',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || 'job-portal',
  // "cloudinary" | "local". Defaults to cloudinary when credentials exist.
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || (process.env.CLOUDINARY_API_SECRET ? 'cloudinary' : 'local'),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 15),

  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Job Portal <onboarding@resend.dev>',

  ENABLE_SCHEDULER: bool(process.env.ENABLE_SCHEDULER, true),
  REMINDER_CRON: process.env.REMINDER_CRON || '0 * * * *',
  DEFAULT_REMINDER_DAYS: list(process.env.DEFAULT_REMINDER_DAYS || '7,3,1').map(Number).filter((n) => n >= 0),
};

export function assertEnv() {
  const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (env.NODE_ENV === 'production' && env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
}
