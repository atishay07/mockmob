// Today's greeting (TODAY-1017 section 5), by the student's local hour, the same rule as the app (wt-v15-today2
// b9a02c18): morning from 5 AM, afternoon from noon, evening from 5 PM to midnight. After midnight it never claims the
// evening (owner D28: "Good evening" at 2:41 am): until 5 AM it is a plain "Hello", with no comment on the hour (the
// "Up late" line retired with the sleepy Mobi). PURE. After 7 or more days away: "Welcome back".
// A name that is a handle (it has a digit, '-', '_' or '.', or equals the email's local part) is left out.

/** The first name to greet, or '' when there is none or it is a handle. */
export function greetName(name, email = '') {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  if (!first) return '';
  if (/[\d_.\-@]/.test(first)) return '';
  const local = String(email || '').split('@')[0].toLowerCase();
  if (local && first.toLowerCase() === local) return '';
  return first;
}

export function greeting({ hour = 18, name = '', email = '', returning = false } = {}) {
  const who = greetName(name, email);
  const lead = returning ? 'Welcome back' : hour < 5 ? 'Hello' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return who ? `${lead}, ${who}` : lead;
}

/**
 * The greeting only once the hour is known (D28, release 9): `hour` null (the server render, before this device's clock is read)
 * gives null, so no screen ever draws a time-of-day greeting the server guessed. A known hour gives `greeting(...)`.
 */
export function greetingAt({ hour = null, ...rest } = {}) {
  return Number.isInteger(hour) && hour >= 0 && hour < 24 ? greeting({ hour, ...rest }) : null;
}
