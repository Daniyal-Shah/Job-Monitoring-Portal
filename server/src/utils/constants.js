// Shared enums. Keep in sync with client/src/lib/constants.ts.

export const APPLICATION_STATUSES = [
  'discovered',
  'applied',
  'eligibility_review',
  'eligible',
  'not_eligible',
  'test_scheduled',
  'test_appeared',
  'test_passed',
  'test_failed',
  'interview_scheduled',
  'interviewed',
  'merit_list',
  'selected',
  'not_selected',
  'withdrawn',
];

export const STATUS_LABELS = {
  discovered: 'Discovered (not applied)',
  applied: 'Applied',
  eligibility_review: 'Eligibility verification',
  eligible: 'Eligible',
  not_eligible: 'Not eligible',
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

// Statuses where the recruitment process is over.
export const CLOSED_STATUSES = ['not_eligible', 'test_failed', 'selected', 'not_selected', 'withdrawn'];
// Statuses where the application has not yet been submitted (deadline reminders apply).
export const PRE_SUBMISSION_STATUSES = ['discovered'];

export const FEE_STATUSES = ['not_required', 'unpaid', 'paid'];

export const EVENT_TYPES = [
  'written_test',
  'physical_test',
  'interview',
  'document_verification',
  'result_announcement',
  'merit_list',
  'other',
];

export const EVENT_LABELS = {
  written_test: 'Written test',
  physical_test: 'Physical test',
  interview: 'Interview',
  document_verification: 'Document verification',
  result_announcement: 'Result announcement',
  merit_list: 'Merit list',
  other: 'Event',
};

export const EVENT_STATUSES = ['scheduled', 'postponed', 'completed', 'cancelled'];

export const DOCUMENT_TYPES = [
  'advertisement_image',
  'advertisement_pdf',
  'challan_form',
  'paid_challan',
  'application_form',
  'application_receipt',
  'roll_number_slip',
  'test_result',
  'interview_letter',
  'merit_list',
  'offer_letter',
  'other',
];

export const NOTIFICATION_KINDS = ['new_job', 'deadline', 'challan', 'event', 'status_change', 'test'];
