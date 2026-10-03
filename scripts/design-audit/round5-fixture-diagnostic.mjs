import { browser, context } from './round5-browser.mjs';
const b = await browser();
try {
  for (const theme of ['dark', 'light', 'dark', 'light', 'dark', 'light']) {
    const c = await context(b, 320, 860), p = await c.newPage();
    await p.bringToFront();
    await c.addInitScript(theme => {
      localStorage.setItem('mm:theme:v1', theme);
      window.__r5Trace = [];
      let current = window.fetch;
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        get() {
          const fetchNow = current;
          return (...args) => {
            const path = String(args[0]);
            window.__r5Trace.push({ path, called: true });
            return Promise.resolve(fetchNow.apply(window, args)).then(r => {
              if (path.startsWith('/api/')) r.clone().json().then(body => window.__r5Trace.push({ path, status: r.status, id: body?.id, state: body?.state })).catch(error => window.__r5Trace.push({ path, parseError: error.message }));
              return r;
            });
          };
        },
        set(fn) { current = fn; },
      });
    }, theme);
    p.on('pageerror', error => console.log(error.stack));
    await p.goto('http://localhost:3010/preview/arena?view=progress');
    await p.getByText('Your first server-scored session is recorded.', { exact: true }).waitFor({ timeout: 10000 }).catch(() => {});
    console.log(JSON.stringify({ theme, trace: await p.evaluate(() => window.__r5Trace), visibility: await p.evaluate(() => document.visibilityState), rendered: await p.locator('.recovery-lab').allTextContents() }));
    await c.close();
  }
} finally { await b.close(); }
