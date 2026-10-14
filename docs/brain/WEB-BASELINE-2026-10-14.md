# Web baseline, 14 Oct 2026

Branch feat/web-redesign, cut from fix/web-state-home (613235c, logo B) with origin/main (4bf41b8) merged in. The merge had no conflicts. The app backend routes under src/app/api and src/lib/server now exist, and src/proxy.js is present.

## Unit suites (run before any redesign change)

| Script | Tests | Pass | Fail |
| --- | --- | --- | --- |
| test:recovery | 39 | 39 | 0 |
| test:visitor | 22 | 22 | 0 |
| test:nta | 22 | 22 | 0 |
| test:study | 22 | 21 | 1 |
| test:answer-integrity | 11 | 11 | 0 |
| test:auth | 50 | 50 | 0 |
| test:du | 19 | 19 | 0 |
| test:learning | 91 | 91 | 0 |
| test:factory | 332 | 332 | 0 |

Total 608 tests, 607 pass, 1 fail.

## Known failure

test:study, "the content gate quarantines changed arithmetic, unsourced vocabulary and unsupported reading keys". The result is wordnet LICENSE_UNAVAILABLE. Cause: core.autocrlf=true on this machine checks data/study/sources/WORDNET-LICENSE.txt out with CRLF line endings, and scripts/learning/validate-study-content.mjs compares it byte for byte with the LF text stored in the content file. The files involved come unchanged from origin/main, so this is a Windows checkout issue and not caused by the merge or the redesign. Not fixed here.

## Lint

npx eslint on the 72 JS, JSX and MJS files changed against 613235c: exit 0, no warnings or errors.

## Notes

- test:factory rewrites tracked files under logs/audit and logs/model_tests. They were restored with git checkout after the run. Do the same after running it again.
- test:auth prints "fetch failed" and refresh token messages. These are expected from tests that exercise failure paths, and all 50 pass.
