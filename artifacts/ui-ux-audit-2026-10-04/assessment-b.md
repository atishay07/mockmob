# Assessment B — independent implementation evidence

Method: isolated technical sub-agent `/root/technical_assessment`. Assessment A, parent findings and existing UI audit reports were not read. This is a bounded source audit, not a claim of WCAG conformance, real-device performance or production availability.

## Technical health

| Dimension | Score / 4 | Evidence |
|---|---:|---|
| Accessibility | 2 | Accessible names and real controls are widespread, but custom radio/tab keyboard contracts and duplicated main landmarks remain. |
| Performance | 3 | Visibility-gated animation and deferred embeds are implemented. One active width transition remains; no measured frame-time, bundle or LCP evidence was collected. |
| Theming | 3 | Current light/dark semantic tokens and scoped exam skins resolve many detector alerts. Documentation and inline legacy values still require careful contextual review. |
| Responsive design | 3 | Phone breakpoints, wrapping controls, dynamic viewport units and safe-area padding are present. Several secondary targets fall below the product's 44px floor. |
| Implementation integrity | 3 | The product-specific sample, recovery example and sourced admissions interaction are coherent. Deterministic advisories mostly identify incomplete machine-readable documentation, legacy skin exceptions or token fallbacks. |
| **Total** | **14 / 20 — Good** | Address the keyboard/semantics and target-size exceptions before treating the interface as release-verified. |

Integrity verdict: **pass with isolated implementation issues**. The detector does not establish that the page is generic, misleading or visually inconsistent. Its advisories are not a count of user-visible defects.

## Detector evidence

The prescribed CLI ran **once**, returned exit code **2** (findings), and produced valid JSON saved intact as `detector.json`. No CSS-only target was passed. There were **137 raw findings: 135 advisory, 2 warning**, across three files.

| Rule | Total | `du.css` | `TestPageClient.jsx` | `DynamicCompassPreview.jsx` |
|---|---:|---:|---:|---:|
| `design-system-color` | 60 | 17 | 43 | 0 |
| `design-system-font-size` | 57 | 38 | 19 | 0 |
| `design-system-radius` | 18 | 3 | 15 | 0 |
| `layout-transition` | 2 | 1 | 0 | 1 |
| **Total** | **137** | **59** | **77** | **1** |

Targets: `src/app/page.js`, `src/components/landing`, `src/components/NavBar.jsx`, `src/components/ThemeToggle.jsx`, `src/components/du`, `src/app/(app)/test/TestPageClient.jsx`. These comprise 31 target-tree files; additional relevant layout/theme styles were inspected without a second scan. Review remained well below the approximately 100-file cap. No ignore list was added or changed.

### Verified false positives and contextual exceptions

- **Theme fallbacks are not the applied light-mode colors.** The `du.css:772,776,810,814,868,891,988,992,996,1058` color advisories point to fallbacks in `var(--warn-text, …)`, `var(--bad-text, …)` and `var(--good-text, …)`. `src/app/marketing-theme.css:10,22` supplies different night/day roles. The warning red/amber fallback is not evidence of a light-mode contrast failure. Translucent status backgrounds at `du.css:809,813,867,987,991,995` are separate from the tokenized text color. `#e0b93f` is also described in DESIGN.md's diagnostic palette prose.
- **Print black is deliberate.** The `du.css:1471` color alert lies inside `@media print` (`1466–1481`) and produces an ink-friendly black-on-white print. Do not remove this based on a palette advisory.
- **The runner uses two intentionally different skins.** All **77** runner advisories require cascade/skin review, not bulk conversion to the marketing frontmatter. DESIGN.md:233,298,581–585,619–622 separates the app and NTA skins from marketing; small console radii and conventional exam colors are intentional. `src/app/(app)/arena.css:57–114` implements current light tokens, and `829–900` overrides runner control colors, sizes and radii specifically for `data-interface="mockmob"`. Therefore literals at `TestPageClient.jsx:903,943–945,1091–1094,1281–1294`, for example, do not alone prove a rendered theme defect. The entire 77-alert group was context-reviewed; not every legacy selector received computed-style validation.
- **The detector reads a narrower ramp than the human documentation.** Of 57 font alerts, **16** have `ignoreValue=0.8125rem` and **11** have `ignoreValue=0.9375rem`. DESIGN.md:309 explicitly includes 0.8125rem labels, and :434 documents 0.9375rem navigation. These values are not universally prohibited. The markup/CSS location and text role still matter; this is a documentation coverage caveat, not 27 confirmed accessibility errors.
- **One width warning is inactive legacy code.** `DynamicCompassPreview.jsx:90` genuinely contains `transition: width`, but no import/use of `DynamicCompassPreview` was found in the prescribed landing directory or homepage. It is not evidence of current homepage jank. Its interval does respect reduced motion at mount (`102–108`); the unused component's animation helpers should be cleaned up if reactivated.
- **One width warning is active.** `du.css:1280` animates the teaser's stream bar width after subject changes, rendered by `EligibilityTeaser.jsx:157`. This is a small, input-driven indicator, not an unbounded layout animation. See B6. Global `.mm` reduced-motion duration reduction at `globals.css:3791–3799` applies to this teaser; do not claim it ignores reduced motion.
- **Large promotional choreography is not automatically bad UI motion.** The homepage has a deliberate marketing motion world. Current source gates Lab playback on a bounded readable region, honors document visibility and supplies manual controls. Timed answering has separate quiet styling (`arena-support.css:9–12`). No duration was penalized merely for exceeding a generic UI transition range.

## Verified findings

**Issue count: six independent groups — P0: 0, P1: 1, P2: 4, P3: 1.** These are manually reviewed findings, not the 137 raw alerts. Some are source-established implementation defects; conditional device consequences are explicitly labelled.

### B1 [P1] Secondary touch targets break the phone target contract

Locations: `src/app/feature-tour.css:57,59–60`; controls in `src/components/landing/FeatureTour.jsx:109–118`; `src/components/du/du.css:267–275`, control in `SubjectPicker.jsx:52`.

The tour's adjacent dot buttons are **20×44px**, with no gap declared inside their flex group. They are shown below the desktop breakpoint (the dots are hidden from 900px at `feature-tour.css:112`). Eight dense adjacent dots are below the product's 44×44px floor, and their 20px pitch does not meet WCAG 2.2 SC 2.5.8's 24px target-or-spacing geometry. The pause button is **38×38px**, and the calculator finder-clear button is **2.25rem square (36px at the 16px marketing root)**: these meet the lower 24px threshold but miss the owner's 44px requirement. Later inspected homepage/theme styles do not enlarge these targets.

Impact: thumb users can select neighboring features accidentally; reduced dexterity makes the small clear/pause controls harder to use.

Recommendation: retain the small visible dot/icon but expand the actual button to 44px. Use a swipe rail or wrap the dot group if eight 44px buttons cannot fit alongside arrows. Verify spacing and focus rings at 320px. Suggested command: `$impeccable adapt`.

### B2 [P2] The tour claims tab semantics without a tab keyboard/panel contract

Location: `src/components/landing/FeatureTour.jsx:80–104,109–114`; autoplay `55–72`; desktop hidden slides `src/app/feature-tour.css:93`.

The controls declare `role="tablist"` and `role="tab"`, but every button remains in the tab sequence, there is no arrow/Home/End handler, no roving `tabIndex`, and no `aria-controls`/`tabpanel` association. Their actual behavior is a carousel picker. Source also shows autoplay continues while keyboard focus is within the tour: only touch/pointer/wheel activity records an interaction. On desktop the next slide hides the previously active slide, which can include its focused CTA. This focus consequence is a **source-supported risk**, not a recorded runtime reproduction.

Impact: assistive technology announces tabs but users receive a different interaction model; a keyboard user reading a feature can lose the visible focused CTA on automatic advance.

Recommendation: implement a complete tabs/carousel contract, or use labelled picker buttons with the current state announced. Pause automatic advance while focus is within the tour and restart only on explicit play. Keep all features available in the existing secondary list. Suggested command: `$impeccable harden`.

### B3 [P2] The DU category radio group lacks arrow-key selection

Location: `src/components/du/CutoffCalculator.jsx:473–479`.

Buttons use `role="radio"` and `aria-checked` in a radiogroup but provide only `onClick`. All stay tabbable; none implements the arrow-key/roving-focus behavior implied by the radio pattern. Native buttons remain operable with Tab and Enter/Space, so this is not a claim of a keyboard trap.

Impact: a keyboard or screen-reader user expecting radio-group navigation must tab across separate controls instead. Recommendation: use native labelled radios with the current button styling, or implement roving focus and arrow selection. Suggested command: `$impeccable harden`.

Related, lower-confidence improvement: test answers at `TestPageClient.jsx:608–617` use grouped toggle buttons (`aria-pressed`) for an exclusive selection. This clearly exposes a pressed state and has numeric 1–4 shortcuts at `431–444`; it is not counted as a missing-name/keyboard failure. Native radios would convey single-choice semantics more directly. The landing `ExamComparator.jsx:81–83` already provides a native-radio example worth reusing.

### B4 [P2] The timed runner nests one main landmark inside another

Locations: outer `src/app/(app)/AppLayoutClient.jsx:319–324`; inner `src/app/(app)/test/TestPageClient.jsx:719`; route/layout composition in `src/app/(app)/layout.js:17–18` and `test/page.js:5–6`.

The shared app layout wraps its route children in `<main>`, and the runner adds another `<main className="nta-shell">`. Both occur in the same active route. This is a verified source composition issue, independent of authenticated browser access.

Impact: landmark navigation presents duplicated/nested primary content instead of one primary landmark; HTML permits only one non-hidden main and prohibits main as a descendant of main.

Recommendation: keep the app layout's main and render the runner container as a div or labelled section. Preserve its existing class/layout. Suggested command: `$impeccable harden`.

### B5 [P2] The subject finder shrinks editable text below the documented mobile input floor

Location: `src/components/du/du.css:247–255`; input in `src/components/du/SubjectPicker.jsx:44–50`; document requirement `DESIGN.md:425`.

The search input specifies **0.9375rem (15px at the marketing root)**, while the documented input style is 16px specifically to avoid iOS focus zoom. Other DU inputs correctly use 1rem (`du.css:431–440`). The font declaration is verified; automatic zoom remains an **unverified device consequence**, because no iOS hardware/Safari session was used.

Impact: focusing the finder can zoom/recompose the calculator on iOS, interrupting one-handed selection. Recommendation: use at least 1rem for editable fields while keeping surrounding captions smaller. Do not disable viewport zoom; the current viewport has no maximum-scale restriction (`src/app/layout.js:59–64`). Suggested command: `$impeccable adapt`.

### B6 [P3] One active teaser bar animates width

Location: `src/components/du/du.css:1275–1280`; `EligibilityTeaser.jsx:157`.

The selected subject mix changes a width over 450ms. This causes layout updates while the bar interpolates. It is a confined data indicator, with reduced-motion fallback inherited from `.mm`; no dropped frames were measured.

Impact: a small avoidable rendering cost on the budget Android floor. Recommendation: keep a full-width fill and animate `transform: scaleX(...)` from its left origin, with numeric labels unchanged. Suggested command: `$impeccable optimize`.

## Positive implementation evidence

- **Meaningful labels and states:** DU searches have visually hidden label text, selectors have wrapping labels, the score field has explanatory `aria-describedby`, multi-select subject chips expose `aria-pressed`, and native sample radios label their answer text. The theme switch exposes `role="switch"` and `aria-checked` (`ThemeToggle.jsx:76–77`). There is no verified missing-label cluster in these target forms.
- **Motion preserves content and user control:** `MistakeLab.jsx:79–135` gates playback, preserves elapsed time and exposes a settled reduced-motion first stage. `useReadableRegion.js:14–37` combines bounded visibility, header/dock clearance and document visibility. Inactive Lab panels are both `aria-hidden` and inert (`MistakeLab.jsx:194,217,239,252`).
- **Theme switching uses current roles:** `marketing-theme.css:2–23` sets day/night text and surface roles; `arena.css:15–114` implements the app's light/dark equivalent rather than leaving the app permanently dark. NTA stays a distinct skin. `ThemeToggle.jsx:53–56` skips the View Transition for reduced motion.
- **Deferred media and resilient states:** `CreatorReels.jsx:47–64` mounts a lazy iframe only after activation and retains an original-post link, with a delayed/error status. `LiveStatsBand.jsx:81–95` aborts the request on unmount and hides unavailable live figures rather than manufacturing user counts. Campus artwork is labelled illustration (`CollegeDestinations.jsx:28`).
- **Stable, responsive practice controls:** the app establishes 44px floors (`arena-support.css:120–123`), answer options use 56px in the MockMob skin (`arena.css:863–869`), the phone runner uses dynamic-height sheet bounds and safe-area action padding (`TestPageClient.jsx:1415,1442–1448`), and mobile dialog focus handling exists at `TestPageClient.jsx:451–484`.

## Limits and follow-up evidence

No browser overlay exists. The available browser evaluate surface is read-only and does not authorize the detector's mutable title/script preflight; no overlay injection or detector live server was started. No browser presentation/visibility was changed, and no tab or viewport owned by Assessment A was touched. Source review and the saved CLI JSON are Assessment B's fallback signals; the parent collects separate rendered evidence.

No UI changes, tests, builds, database mutations, migrations, production actions, authentication actions, checkout actions or paid model calls were performed. No temporary server needs cleanup. Only this assessment and its detector evidence were written. This audit does not certify contrast throughout every state, actual iOS zoom, keyboard screen-reader announcements, low-end Android frame rates, production content release, auth, payment or AI availability.

Reduced motion was reviewed carefully: global `.mm` and `.app-shell` duration resets remain (`globals.css:3791–3799`, `arena-support.css:119`), but they coexist with explicit static content alternatives and more-specific short Arena fades (`arena-support.css:30–32`). A blanket claim that the reset destroys all useful feedback would be unsupported. The planned follow-up should replace broad suppression with intentional alternatives only where real feedback loss can be reproduced.

Recommended sequence: `$impeccable harden` for role/keyboard/landmark contracts; `$impeccable adapt` for actual tap areas and editable text; `$impeccable optimize` for the confined bar if warranted; finish with `$impeccable polish`. Re-run the audit after implementation and use real phone/pointer/screen-reader checks to validate the fixes.

## Raw detector locations

The appendix below lists every raw finding; these rows retain detector terminology and are not independently accepted defects. `detector.json` retains the full original descriptions, severities and snippets.

| Rule | File | Line | Raw snippet |
|---|---|---:|---|
| `layout-transition` | `src/components/landing/DynamicCompassPreview.jsx` | 90 | transition: width |
| `layout-transition` | `src/components/du/du.css` | 1280 | transition: width |
| `design-system-font-size` | `src/components/du/du.css` | 58 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 66 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 105 | font-size: 1.5rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 181 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 201 | font-size: 0.75rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 291 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 317 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 324 | font-size: 0.75rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 331 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 400 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 601 | font-size: 0.75rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 619 | font-size: 1.125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 624 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 686 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 747 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 763 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-color` | `src/components/du/du.css` | 772 | Undocumented color #e0b93f is outside DESIGN.md colors |
| `design-system-font-size` | `src/components/du/du.css` | 775 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-color` | `src/components/du/du.css` | 776 | Undocumented color #e0b93f is outside DESIGN.md colors |
| `design-system-font-size` | `src/components/du/du.css` | 795 | font-size: 0.75rem is off the DESIGN.md type ramp |
| `design-system-color` | `src/components/du/du.css` | 809 | Undocumented color rgba(224, 185, 63, 0.15) is outside DESIGN.md colors |
| `design-system-color` | `src/components/du/du.css` | 810 | Undocumented color #e0b93f is outside DESIGN.md colors |
| `design-system-color` | `src/components/du/du.css` | 813 | Undocumented color rgba(255, 122, 107, 0.12) is outside DESIGN.md colors |
| `design-system-color` | `src/components/du/du.css` | 814 | Undocumented color #ff9d92 is outside DESIGN.md colors |
| `design-system-font-size` | `src/components/du/du.css` | 833 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-color` | `src/components/du/du.css` | 867 | Undocumented color rgba(255, 122, 107, 0.16) is outside DESIGN.md colors |
| `design-system-color` | `src/components/du/du.css` | 868 | Undocumented color #ff9d92 is outside DESIGN.md colors |
| `design-system-font-size` | `src/components/du/du.css` | 886 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-color` | `src/components/du/du.css` | 891 | Undocumented color #ff9d92 is outside DESIGN.md colors |
| `design-system-font-size` | `src/components/du/du.css` | 934 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 939 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 960 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-radius` | `src/components/du/du.css` | 967 | border-radius: 4px is outside the DESIGN.md rounded scale |
| `design-system-font-size` | `src/components/du/du.css` | 969 | font-size: 0.625rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 978 | font-size: 0.75rem is off the DESIGN.md type ramp |
| `design-system-color` | `src/components/du/du.css` | 987 | Undocumented color rgba(160, 220, 90, 0.14) is outside DESIGN.md colors |
| `design-system-color` | `src/components/du/du.css` | 988 | Undocumented color #b6e36e is outside DESIGN.md colors |
| `design-system-color` | `src/components/du/du.css` | 991 | Undocumented color rgba(224, 185, 63, 0.15) is outside DESIGN.md colors |
| `design-system-color` | `src/components/du/du.css` | 992 | Undocumented color #e0b93f is outside DESIGN.md colors |
| `design-system-color` | `src/components/du/du.css` | 995 | Undocumented color rgba(255, 122, 107, 0.12) is outside DESIGN.md colors |
| `design-system-color` | `src/components/du/du.css` | 996 | Undocumented color #ff9d92 is outside DESIGN.md colors |
| `design-system-font-size` | `src/components/du/du.css` | 1034 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1053 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-color` | `src/components/du/du.css` | 1058 | Undocumented color #ff9d92 is outside DESIGN.md colors |
| `design-system-font-size` | `src/components/du/du.css` | 1108 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1112 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1156 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1235 | font-size: clamp(3rem, 7vw, 4.5rem) has fluid endpoint 4.5rem off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1249 | font-size: 0.9375rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1265 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-radius` | `src/components/du/du.css` | 1271 | border-radius: 3px is outside the DESIGN.md rounded scale |
| `design-system-radius` | `src/components/du/du.css` | 1278 | border-radius: 3px is outside the DESIGN.md rounded scale |
| `design-system-font-size` | `src/components/du/du.css` | 1293 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1316 | font-size: 1.5rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1326 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1357 | font-size: clamp(1.85rem, 4.6vw, 3.25rem) has fluid endpoints 1.85rem and 3.25rem off the DESIGN.md type ramp |
| `design-system-font-size` | `src/components/du/du.css` | 1442 | font-size: 0.8125rem is off the DESIGN.md type ramp |
| `design-system-color` | `src/components/du/du.css` | 1471 | Undocumented color #000 is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 659 | text-[…] class: 24px is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 882 | font-size: 10px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 900 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 903 | Undocumented color #d4d4d8 is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 921 | font-size: 10px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 934 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 943 | Undocumented color rgba(248,113,113,.45) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 944 | Undocumented color rgba(248,113,113,.1) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 945 | Undocumented color #fca5a5 is outside DESIGN.md colors |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 958 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 959 | Undocumented color rgba(251,191,36,.28) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 960 | Undocumented color rgba(251,191,36,.08) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 961 | Undocumented color #fde68a is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 962 | font-size: 13px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 976 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 978 | Undocumented color rgba(0,0,0,.28) is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 994 | font-size: 22px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1006 | border-radius: 6px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1007 | Undocumented color #d4d4d8 is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1010 | font-size: 10px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1019 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1028 | font-size: 10px is off the DESIGN.md type ramp |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1040 | Undocumented color #d4d4d8 is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1041 | font-size: 15px is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1074 | font-size: 10px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1081 | border-radius: 6px is outside the DESIGN.md rounded scale |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1085 | font-size: 9px is off the DESIGN.md type ramp |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1089 | Undocumented color #a1a1aa is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1091 | Undocumented color #86efac is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1091 | Undocumented color rgba(74,222,128,.38) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1091 | Undocumented color rgba(74,222,128,.08) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1093 | Undocumented color #c4b5fd is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1093 | Undocumented color rgba(168,85,247,.42) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1093 | Undocumented color rgba(168,85,247,.1) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1094 | Undocumented color #fca5a5 is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1094 | Undocumented color rgba(248,113,113,.34) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1094 | Undocumented color rgba(248,113,113,.08) is outside DESIGN.md colors |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1101 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1103 | Undocumented color #d4d4d8 is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1106 | font-size: 12px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1133 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1135 | Undocumented color #e4e4e7 is outside DESIGN.md colors |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1154 | border-radius: 7px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1156 | Undocumented color #a1a1aa is outside DESIGN.md colors |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1181 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1190 | font-size: 13px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1215 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1218 | Undocumented color rgba(0,0,0,.22) is outside DESIGN.md colors |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1235 | border-radius: 8px is outside the DESIGN.md rounded scale |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1242 | font-size: 22px is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1249 | font-size: 9px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1267 | border-radius: 7px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1270 | Undocumented color #a1a1aa is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1272 | font-size: 12px is off the DESIGN.md type ramp |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1281 | Undocumented color rgba(74,222,128,.16) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1282 | Undocumented color rgba(74,222,128,.5) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1283 | Undocumented color #86efac is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1286 | Undocumented color rgba(248,113,113,.1) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1287 | Undocumented color rgba(248,113,113,.42) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1288 | Undocumented color #fca5a5 is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1292 | Undocumented color rgba(168,85,247,.14) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1293 | Undocumented color rgba(168,85,247,.5) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1294 | Undocumented color #c4b5fd is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1304 | Undocumented color #86efac is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1305 | Undocumented color rgba(0,0,0,.65) is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1312 | font-size: 10px is off the DESIGN.md type ramp |
| `design-system-radius` | `src/app/(app)/test/TestPageClient.jsx` | 1324 | border-radius: 3px is outside the DESIGN.md rounded scale |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1328 | Undocumented color rgba(74,222,128,.16) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1328 | Undocumented color rgba(74,222,128,.5) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1329 | Undocumented color rgba(168,85,247,.14) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1329 | Undocumented color rgba(168,85,247,.5) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1330 | Undocumented color rgba(248,113,113,.1) is outside DESIGN.md colors |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1330 | Undocumented color rgba(248,113,113,.42) is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1397 | font-size: 18px is off the DESIGN.md type ramp |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1423 | font-size: 12px is off the DESIGN.md type ramp |
| `design-system-color` | `src/app/(app)/test/TestPageClient.jsx` | 1435 | Undocumented color rgba(0,0,0,.62) is outside DESIGN.md colors |
| `design-system-font-size` | `src/app/(app)/test/TestPageClient.jsx` | 1462 | font-size: 18px is off the DESIGN.md type ramp |
