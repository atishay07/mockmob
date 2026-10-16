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
  // In-product steps (migration 20261016120000). Counted on the server, once per user (see ONCE_PER_USER_STEPS).
  'first_practice_started',
  'first_practice_finished',
  'first_mock_finished',
  'first_repair',
  'pricing_viewed',
  'checkout_opened',
  'payment_captured',
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

// After sign up, the signed-in steps, in the order a student usually reaches them. Shown on /admin/funnel
// under the landing stages. Each is counted once per user, so these are people, not events.
export const FUNNEL_PRODUCT_STAGES = Object.freeze([
  { step: 'first_practice_started', label: 'Started a first practice' },
  { step: 'first_practice_finished', label: 'Finished a first practice' },
  { step: 'first_mock_finished', label: 'Finished a first timed mock' },
  { step: 'first_repair', label: 'Ran a first repair' },
  { step: 'pricing_viewed', label: 'Viewed pricing' },
  { step: 'checkout_opened', label: 'Opened checkout' },
  { step: 'payment_captured', label: 'Paid' },
]);

// Steps the server counts for a signed-in user, at most once per user: a flag on the user's own row
// (users.funnel_seen) decides, inside funnel_count_once, so the funnel table itself never holds an id.
export const ONCE_PER_USER_STEPS = Object.freeze(FUNNEL_PRODUCT_STAGES.map((s) => s.step));

export const FUNNEL_SIDE_STEPS = Object.freeze([{ step: 'login_click', label: 'Chose log in' }]);

// Steps the server counts itself. The browser beacon is refused for these, so a step is never counted
// twice and nobody can inflate it from outside. signup_complete is counted where the account row is
// first created (src/lib/auth.ts, through ensureDbUser).
export const SERVER_ONLY_STEPS = Object.freeze(['signup_complete', ...ONCE_PER_USER_STEPS]);

// The only platform categories that exist. Derived on the server from the User-Agent at request time
// (platformFromUserAgent in src/lib/server/funnel.js); the User-Agent itself is never kept. The same
// list is a check constraint in the database, so adding a platform needs a migration too.
export const FUNNEL_PLATFORMS = Object.freeze(['desktop', 'android_web', 'ios_web', 'android_app', 'other']);

export const FUNNEL_PLATFORM_LABELS = Object.freeze({
  desktop: 'Desktop',
  android_web: 'Android browser',
  ios_web: 'iPhone and iPad browser',
  android_app: 'Android app',
  other: 'Other',
});

export const FUNNEL_PATH = '/api/funnel';

export function isFunnelPlatform(platform) {
  return typeof platform === 'string' && FUNNEL_PLATFORMS.includes(platform);
}

export function isFunnelStep(step) {
  return typeof step === 'string' && FUNNEL_STEPS.includes(step);
}
