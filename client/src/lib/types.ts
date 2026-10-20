import type { ApplicationStatus, DocumentType, EventStatus, EventType, FeeStatus } from './constants';

export interface NotificationPrefs {
  enabled: boolean;
  newJobs: boolean;
  allNewJobs: boolean;
  deadlines: boolean;
  challans: boolean;
  events: boolean;
  statusChanges: boolean;
  reminderDays: number[];
}

export interface Member {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  relation?: string;
  dateOfBirth?: string;
  qualification?: string;
  domicile?: string;
  notes?: string;
  color: string;
  active: boolean;
  notifications: NotificationPrefs;
  applicationCount?: number;
  login?: { email: string; active: boolean; lastLoginAt?: string } | null;
}

export type MemberRef = Pick<Member, '_id' | 'name' | 'color'> & { email?: string };

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  member?: Member | null;
}

export interface Job {
  _id: string;
  title: string;
  department: string;
  organization?: string;
  advertisementNumber?: string;
  advertisementDate?: string;
  bps?: number;
  salary?: string;
  numberOfPosts?: number;
  location?: string;
  qualification?: string;
  eligibility?: string;
  ageLimit?: string;
  applicationFee?: number;
  lastDate?: string;
  officialLink?: string;
  applyLink?: string;
  notes?: string;
  tags?: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { _id: string; name: string };
  applications?: { _id: string; status: ApplicationStatus; member: MemberRef; fee?: { status: FeeStatus } }[];
}

export interface Fee {
  status: FeeStatus;
  amount?: number;
  challanNumber?: string;
  bank?: string;
  dueDate?: string | null;
  paidDate?: string | null;
  notes?: string;
}

export interface TimelineEntry {
  _id: string;
  status: ApplicationStatus;
  note?: string;
  date: string;
  byName?: string;
}

export interface Application {
  _id: string;
  job: Job;
  member: MemberRef;
  status: ApplicationStatus;
  appliedDate?: string;
  applicationNumber?: string;
  rollNumber?: string;
  testCentre?: string;
  marks?: string;
  meritPosition?: string;
  notes?: string;
  fee: Fee;
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentEvent {
  _id: string;
  application: string;
  job: string | Pick<Job, '_id' | 'title' | 'department'>;
  member: string | MemberRef;
  type: EventType;
  title?: string;
  date: string;
  location?: string;
  notes?: string;
  status: EventStatus;
}

export interface Doc {
  _id: string;
  title: string;
  type: DocumentType;
  job?: string | Pick<Job, '_id' | 'title' | 'department'>;
  application?: string;
  member?: string | MemberRef | null;
  mimeType?: string;
  bytes?: number;
  originalName?: string;
  createdAt: string;
}

export interface CalendarItem {
  id: string;
  kind: 'deadline' | 'challan' | 'event';
  type?: EventType;
  status?: EventStatus;
  title: string;
  subtitle?: string;
  location?: string;
  date: string;
  dateOnly: boolean;
  link: string;
  eventId?: string;
  members: (MemberRef & { status?: ApplicationStatus })[];
}

export interface NotificationLog {
  _id: string;
  kind: string;
  email: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  attempts: number;
  simulated?: boolean;
  sentAt?: string;
  createdAt: string;
  member?: MemberRef;
  job?: { _id: string; title: string };
  application?: string;
}
