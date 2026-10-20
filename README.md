# Job Application Portal

A web app for tracking government job applications (FPSC, PPSC, SPSC, NTS, …) for several family members: job ads, documents, challans, recruitment progress, a calendar and automatic email reminders.

- **client/**: React + TypeScript + Vite + Tailwind CSS v4, TanStack Query
- **server/**: Node.js + Express 5 + Mongoose (MongoDB Atlas), Cloudinary (private files), Resend (email), node-cron (reminders)

## Features

| Area | What it does |
|---|---|
| Dashboard | Active jobs, in-progress applications, deadlines, unpaid/overdue challans, upcoming tests and interviews, recent updates. You can filter it by family member. |
| Jobs | Create, edit, archive, delete and search ads (title, department, recruiting body, ad no., BPS, fee, last date, eligibility, links). Assign a job to members when you create it or later. |
| Applications | One per member per job. Tracks status across 15 stages (found → applied → eligibility → test → interview → merit list → selected/not selected), with a timeline of every change and its notes, plus roll/application numbers, marks and merit position. |
| Challans & fees | Amount, challan/PSID no., bank, due date, paid date and status. Shows paid, unpaid and overdue fees with totals, and has a one-click "Mark paid". |
| Documents | Upload images or PDFs: ad photos and PDFs, challans, receipts, roll number slips, results and letters. They attach to a job or an application. Files are stored **privately** and opened through signed links that expire after 10 minutes. |
| Calendar | Month view and an upcoming list of last dates, challan due dates and recruitment events. Changing a date reschedules its reminders. |
| Email reminders | New job, application deadline (until applied), unpaid challan, upcoming test/interview/event, and status change. Each member picks which ones they get and how many days before (for example 7, 3, 1). The same reminder is never sent twice, failed sends are retried up to 3 times, and every email is logged. |
| Family members | Profiles with colour, domicile, qualification and notification preferences. Each member can optionally get their own login and sees **only their own** applications, documents and payments. |
| Reports | Counts by status, member and department, fees paid per month, upcoming events, and a CSV export of expenses. |

### Roles
- **Admin** (the first account): full access.
- **Member** (login linked to a family member): sees their own data only. A member can update their applications' status, fees, events and documents, and their own notification preferences. They can't create or delete jobs or see siblings' data.

## Local development

Requirements: Node 20+, a MongoDB connection string (a free MongoDB Atlas cluster works, or a local `mongod`).

```bash
npm run install:all
cp server/.env.example server/.env   # then fill in MONGODB_URI and JWT_SECRET
npm run dev:server                   # API on http://localhost:4000
npm run dev:client                   # UI on http://localhost:5173
```

Open http://localhost:5173. The first visit asks you to create the admin account. You can also create it from the command line with `npm --prefix server run create-admin -- "Name" you@example.com "password"`.

You don't need Cloudinary or Resend to try it out locally:
- With no Cloudinary keys, files are saved to `server/uploads/` and served through HMAC-signed, expiring URLs.
- With no `RESEND_API_KEY`, emails are printed to the server console and logged as "simulated".

## Environment variables

See [`server/.env.example`](server/.env.example) (backend) and [`client/.env.example`](client/.env.example) (frontend). The important ones:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | 32+ random chars (`openssl rand -hex 32`) |
| `CLIENT_URL` | Frontend origin(s) allowed by CORS; the first one is used for links in emails |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | Private document storage |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email sending. `EMAIL_FROM` must use a domain you've verified in Resend |
| `REMINDER_CRON`, `APP_TIMEZONE` | When reminders are checked (default: every hour, Asia/Karachi) |
| `DEFAULT_REMINDER_DAYS` | Default offsets for new members (default `7,3,1`) |
| `VITE_API_URL` (client) | Backend URL in production, e.g. `https://api.example.com` |

## Deployment

**Backend (VPS)**
```bash
cd server && npm ci --omit=dev
cp .env.example .env && nano .env      # set NODE_ENV=production and all keys
npm install -g pm2
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```
Put Nginx (or Caddy) in front with HTTPS and proxy to `localhost:4000`. Run only **one** instance: the reminder scheduler runs inside the process. If you scale out, set `ENABLE_SCHEDULER=false` on the extra instances. Another option is to run `npm run reminders` from system cron. Duplicate sends are blocked in any case by a unique key in the database.

In MongoDB Atlas, add the VPS IP to the Network Access list.

**Frontend (Vercel)**: import the repo, set the root directory to `client/`, framework Vite, and the env var `VITE_API_URL=https://your-api-domain`. `vercel.json` already rewrites routes for the SPA. To serve it from the VPS instead, run `npm run build` and serve `client/dist` with an SPA fallback to `index.html`.

## How reminders work

Every scheduled run (and once shortly after start-up), the server checks each active member who has notifications on:
1. **Deadlines**: jobs with status "not applied yet" and a last date coming up.
2. **Challans**: unpaid fees with a due date coming up (the job's last date is used if no due date is set).
3. **Events**: scheduled or postponed tests, interviews, verifications and so on.

For each item it works out the days remaining and finds the smallest configured offset that is ≥ that number. It sends once per (item, member, offset, date). This means a reminder missed during downtime is caught up later. If an item's date changes, reminders are sent again for the new date.

## Project structure

```
server/src
  config/       env + db
  models/       User, Member, Job, Application, Event, Document, Notification
  routes/       REST endpoints (auth, members, jobs, applications, events, documents, calendar, dashboard, reports, notifications)
  services/     storage (Cloudinary/local), email (Resend), emailTemplates, notify, reminders, cleanup
  jobs/         cron scheduler
  scripts/      create-admin, run reminders once
client/src
  lib/          API client, auth context, types, constants, formatters
  components/   UI kit, layout, documents, events, notification preferences
  pages/        one file per screen
```

### Extending
- **Extracting job details from ad images**: add a `services/extraction/` module that is called after an `advertisement_*` document is uploaded. It would pre-fill a draft `Job` for the admin to review.
- **Monitoring recruitment websites**: add a scheduled job under `jobs/` (same pattern as `scheduler.js`) that fetches official pages, compares them with what's stored, and creates `Notification`s through `services/notify.js`.
