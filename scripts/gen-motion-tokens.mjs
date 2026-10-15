// Writes the website's motion tokens from shared/motion-tokens.json (the app reads the same file
// through flutter_app/tool/gen_motion_tokens.py). The work is in src/lib/motion-tokens.mjs.
//   node scripts/gen-motion-tokens.mjs           write src/app/motion-kit.css's block and src/lib/motion/tokens.g.js
//   node scripts/gen-motion-tokens.mjs --check   exit 1 when either is stale
import { main } from '../src/lib/motion-tokens.mjs';

process.exit(main(process.argv.slice(2)));
