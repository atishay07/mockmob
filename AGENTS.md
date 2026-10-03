<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## MockMob implementation contract
Read PRODUCT.md, DESIGN.md, then docs/brain/README.md before changing behavior.
The current direction is Score Recovery for CUET UG 2027 Commerce, AI-integrated.
The working sequence for the coming days is docs/brain/PLAN-2026-10-04-NEXT-DAYS.md.
No routine human review: uncertainty means quarantine, never forced publication.
Never call a paid model outside its persistent budget guard; retries and failures count.
Budgets (owner, 4 Oct 2026): question/content generation USD 50 lifetime ceiling
(scripts/pipeline/lib/budgetLedger.mjs); student-facing AI USD 25 per IST month,
enforced in the database (runtime_ai_budget.monthly_cap_usd). Student AI is enabled
(RELEASE_GATES.runtimeAi); it reaches students only once deployed with the AI_* env vars.
These are the limits. Do not invent stricter ones; ask the owner to change them.
Do not claim model agreement proves truth, or simulated marks are observed gains.
Keep existing user edits, paid entitlements and atomic credit RPCs intact.
Never migrate production data implicitly. Save migrations and dry-run reports first.
Run `npm run test:recovery` and existing question/payment suites after relevant edits.
Record actual verification and unresolved deployment gates in docs/brain/STATUS.md.
