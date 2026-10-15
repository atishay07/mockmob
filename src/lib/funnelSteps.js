// The only funnel steps that exist. Shared by the client helper, the route and the admin summary.
// The same list is enforced in the database (check constraint in 20261015233000_funnel_daily.sql),
// so adding a step needs a migration as well as an edit here.
export const FUNNEL_STEPS = Object.freeze([
  'landing_view',
  'sample_subject_chosen',
  'sample_started',
  'sample_done',
  'signup_click',
  'signup_complete',
  'login_click',
]);

// The funnel in order, as the admin page reads it. login_click is not a stage: returning students
// are counted beside the funnel, not inside it.
export const FUNNEL_STAGES = Object.freeze([
  { step: 'landing_view', label: 'Opened the landing page' },
  { step: 'sample_subject_chosen', label: 'Chose a sample subject' },
  { step: 'sample_started', label: 'Started the sample' },
  { step: 'sample_done', label: 'Finished the sample' },
  { step: 'signup_click', label: 'Chose sign up' },
  { step: 'signup_complete', label: 'Finished signing up' },
]);

export const FUNNEL_SIDE_STEPS = Object.freeze([{ step: 'login_click', label: 'Chose log in' }]);

export const FUNNEL_PATH = '/api/funnel';

export function isFunnelStep(step) {
  return typeof step === 'string' && FUNNEL_STEPS.includes(step);
}
