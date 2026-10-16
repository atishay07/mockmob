// Today's greeting (TODAY-1017 section 5). PURE. Morning before 12, afternoon before 5 PM, evening after (11 PM to
// 5 AM is evening too: the "Up late" line retired with the sleepy Mobi). After 7 or more days away: "Welcome back".
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
  const lead = returning ? 'Welcome back' : hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : 'Good evening';
  return who ? `${lead}, ${who}` : lead;
}
