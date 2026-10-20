// Keep in sync with server/src/utils/constants.js

export const APPLICATION_STATUSES = [
  'discovered', 'applied', 'challan_paid', 'eligibility_review', 'eligible', 'not_eligible', 'awaiting_test_date', 'test_scheduled', 'test_appeared',
  'test_passed', 'test_failed', 'interview_scheduled', 'interviewed', 'merit_list', 'selected', 'not_selected', 'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  discovered: 'Not applied yet',
  applied: 'Applied',
  challan_paid: 'Challan paid & waiting for test date',
  eligibility_review: 'Eligibility verification',
  eligible: 'Eligible',
  not_eligible: 'Not eligible',
  awaiting_test_date: 'Waiting for test date',
  test_scheduled: 'Test scheduled',
  test_appeared: 'Test appeared',
  test_passed: 'Test passed',
  test_failed: 'Test failed',
  interview_scheduled: 'Interview scheduled',
  interviewed: 'Interviewed',
  merit_list: 'On merit list',
  selected: 'Selected',
  not_selected: 'Not selected',
  withdrawn: 'Withdrawn',
};

export const STATUS_TONE: Record<ApplicationStatus, Tone> = {
  discovered: 'slate',
  applied: 'blue',
  challan_paid: 'teal',
  eligibility_review: 'amber',
  eligible: 'teal',
  not_eligible: 'red',
  awaiting_test_date: 'amber',
  test_scheduled: 'violet',
  test_appeared: 'violet',
  test_passed: 'teal',
  test_failed: 'red',
  interview_scheduled: 'indigo',
  interviewed: 'indigo',
  merit_list: 'teal',
  selected: 'green',
  not_selected: 'red',
  withdrawn: 'slate',
};

export const CLOSED_STATUSES: ApplicationStatus[] = ['not_eligible', 'test_failed', 'selected', 'not_selected', 'withdrawn'];

// Recruitment pipeline stages shown as a progress bar.
export const PIPELINE: { label: string; statuses: ApplicationStatus[] }[] = [
  { label: 'Found', statuses: ['discovered'] },
  { label: 'Applied', statuses: ['applied', 'challan_paid'] },
  { label: 'Eligibility', statuses: ['eligibility_review', 'eligible', 'not_eligible'] },
  { label: 'Test', statuses: ['awaiting_test_date', 'test_scheduled', 'test_appeared', 'test_passed', 'test_failed'] },
  { label: 'Interview', statuses: ['interview_scheduled', 'interviewed'] },
  { label: 'Merit', statuses: ['merit_list'] },
  { label: 'Result', statuses: ['selected', 'not_selected'] },
];

export type Tone = 'slate' | 'blue' | 'amber' | 'teal' | 'red' | 'violet' | 'indigo' | 'green';

export const FEE_STATUSES = ['not_required', 'unpaid', 'paid'] as const;
export type FeeStatus = (typeof FEE_STATUSES)[number];
export const FEE_LABELS: Record<FeeStatus | 'overdue', string> = { not_required: 'No fee', unpaid: 'Unpaid', paid: 'Paid', overdue: 'Overdue' };

export const EVENT_TYPES = ['written_test', 'physical_test', 'interview', 'document_verification', 'result_announcement', 'merit_list', 'other'] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_LABELS: Record<EventType, string> = {
  written_test: 'Written test',
  physical_test: 'Physical test',
  interview: 'Interview',
  document_verification: 'Document verification',
  result_announcement: 'Result announcement',
  merit_list: 'Merit list',
  other: 'Other',
};
export const EVENT_STATUSES = ['scheduled', 'postponed', 'completed', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const DOCUMENT_TYPES = [
  'advertisement_image', 'advertisement_pdf', 'challan_form', 'paid_challan', 'application_form', 'application_receipt',
  'roll_number_slip', 'test_result', 'interview_letter', 'merit_list', 'offer_letter', 'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  advertisement_image: 'Advertisement (image)',
  advertisement_pdf: 'Advertisement (PDF)',
  challan_form: 'Challan form',
  paid_challan: 'Paid challan receipt',
  application_form: 'Application form',
  application_receipt: 'Application receipt',
  roll_number_slip: 'Roll number slip',
  test_result: 'Test result',
  interview_letter: 'Interview letter',
  merit_list: 'Merit list',
  offer_letter: 'Offer / appointment letter',
  other: 'Other',
};
export const JOB_DOCUMENT_TYPES: DocumentType[] = ['advertisement_image', 'advertisement_pdf', 'merit_list', 'other'];

export const NOTIFICATION_LABELS: Record<string, string> = {
  new_job: 'New job',
  deadline: 'Deadline reminder',
  challan: 'Challan reminder',
  event: 'Event reminder',
  status_change: 'Status change',
  test: 'Test email',
};

export const MEMBER_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed', '#dc2626', '#475569'];
