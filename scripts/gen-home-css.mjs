// Writes src/app/home-sheets.css, the home page's 23 own sheets joined in their cascade order (one stylesheet request on
// "/" instead of seven). The work and the list are in src/lib/homeCss.mjs.
//   node scripts/gen-home-css.mjs           write the file
//   node scripts/gen-home-css.mjs --check   exit 1 when it is stale
//   node scripts/gen-home-css.mjs --watch   keep it current while you edit (a dev server does this by itself)
import { main } from '../src/lib/homeCss.mjs';

const code = main(process.argv.slice(2));
if (code !== null) process.exit(code);
