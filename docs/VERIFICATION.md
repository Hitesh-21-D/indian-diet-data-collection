# Readiness audit — 11 October 2026

## Subsequent meal-flow revision

Following physical-phone feedback, instruction numbers now have nonshrinking, nonwrapping columns. Instructions stay before the first food entry, while **Your Typical Day** questions follow all meal entries. The selected dietary pattern initializes 2, 3, 4 or 5 occasions. Participants can rename, remove and add occasions, up to eight. The questionnaire's navigation and review use the ordered list rather than hardcoded step positions.

New submissions use schema version 3 with `mealOrder` and per-occasion labels. Rules retain version 2 support and enforce complete atomic batches for both formats. The exporter supports both versions and keeps occasion labels/order in CSV. Old saved browser drafts migrate without losing their food entries or relabeling their combined snacks as a single afternoon snack. No existing server responses are rewritten.

The updated rules must be deployed before the new frontend; the live-rule match reported below describes the earlier audit snapshot, not this not-yet-deployed revision.

Revision validation: TypeScript, ESLint and production build passed; 33 unit tests, 17 Firestore security tests, 6 Python pipeline tests and all 35 browser tests passed. Browser coverage spans the five device/browser profiles below and includes adding, naming, removing and submitting a sixth occasion. The 320 px instructions screenshot was visually inspected. One earlier WebKit run exceeded the test's five-second initial-loading assertion; three targeted repeats passed, and the assertion now allows the application's existing 15-second loading budget. The final full suite passed without retries. All submission tests used local demo emulators.

The published information page was checked read-only, and all submission tests ran against local demo Firebase emulators. No production participant records were read, created or deleted during this audit. The researcher previously confirmed a live submission, removed the synthetic record, and successfully ran the authenticated CSV export.

## Earlier readiness audit results (before the meal-flow revision)

| Check | Result |
| --- | --- |
| TypeScript, ESLint, production build | Passed |
| Unit tests | 31 passed |
| Python data pipeline | 5 passed |
| Firestore emulator security tests | 14 passed |
| Browser tests | 30 passed across desktop Chromium, Pixel 7-sized Chromium, 320 px Chromium, 768 px tablet Chromium and iPhone 13-sized WebKit |
| Production dependency audit | Zero reported vulnerabilities |
| Live project/region | `indian-diet-research`, `asia-south1` (Mumbai), Firestore Native |
| Anonymous Authentication | Enabled |
| Live study policy | Collection enabled; minors disabled; institution, contact, retention, withdrawal and ethics text configured |
| Consent/catalog versions | `adult-v1`; `indb-65f91911de09ebdb-serving-v2` |
| Live Firestore rules | Exact match with local `firestore.rules`, after newline normalization |
| Public mobile page | HTTP 200, expected institution, no JavaScript page errors or horizontal overflow at 390 px |
| Git-tracked private config/exports | No `.env.local` or `exports/` files tracked |

Live metadata was read using the configured researcher's Application Default Credentials. Institutional ethical clearance was reported by the researcher, not independently reviewed in this audit. The policy states indefinite retention and deletion requests within seven days. Authentication authorized domains contain localhost and the two Firebase project domains; the current implementation uses anonymous sign-in, not OAuth redirects. Revisit authorized domains if adding another authentication provider.

## Fixes and additional coverage

Phone forms and tablet layout now reflow without squeezing controls. Phone inputs use 16 px text and touch buttons are larger. Long food names and units wrap in meal lists and review. Food edits warn before navigation discards them. Keyboard-highlighted search options scroll into view. Validation feedback receives focus. Blocking access to localStorage no longer crashes startup. A confirmed server receipt is restored after reload, questionnaire editing is disabled during submission, and initial loading has a bounded retry state. The adult-only enrollment text reflects the policy, and the progress bar matches its percentage.

Browser coverage now includes touch selection, long custom text, error visibility, blocked storage, catalog download failure/retry, and confirmed receipt recovery, in addition to the original full workflow. Screenshots of narrow-phone profile, food entry and WebKit review were visually inspected. A final 320 px refinement stacks avoidance choices to prevent awkward word splitting. CI installs Chromium and WebKit.

## Before recruitment

Deploy the updated Firestore rules first, then push these fixes, wait for **Verify study**, and run **Deploy GitHub Pages** on `main`. Prior workflows were reported green by the researcher; this local audit does not claim that a new remote deployment has run. Test the final deployed page on representative physical phones: emulated browser tests cannot cover every device, keyboard or accessibility setting.

The audit found no remaining failing automated checks. App Check is not implemented/enforced by this code; controlled recruitment and usage monitoring remain necessary. Firestore point-in-time recovery and database deletion protection were disabled at audit time. Protect exported snapshots and process withdrawal requests across Firestore and retained exports. See [RUNNING_THE_STUDY.md](RUNNING_THE_STUDY.md) for the operating procedure. The shared Firebase bundle still produces a nonfatal size warning (about 988 KB uncompressed / 261 KB gzip).

---

## Historical implementation verification — 10 October 2026

The remainder records the original implementation session before live setup and deployment. Its outstanding operational items were superseded by the audit above where explicitly verified.

Completed locally on Windows using Node.js 20.19.0, bundled Python, a project-local Java 21 runtime, Firebase demo emulators and Playwright Chromium. CI recommends Node 22 and Java 21. The CI workflows have been authored but were not run on GitHub.

| Check | Result |
| --- | --- |
| Real workbook inspection/import | Passed: Nutrient Data, 1,014 records, 82 columns; 917 included, 97 excluded |
| TypeScript `npm run typecheck` | Passed |
| ESLint `npm run lint` | Passed; generated tools, build and test artifacts excluded |
| Vitest `npm test` | 31 tests passed |
| Python `python scripts/test_pipeline.py` | 5 tests passed |
| Firestore emulator security suite | 14 tests passed |
| Playwright desktop and Pixel 7 browser suite | 4 tests passed |
| Production `npm run build` | Passed |
| GitHub Pages repository base path | Separate `/test-repository/` build passed; asset prefixes and copied catalog verified |
| `npm audit --omit=dev --audit-level=high` | Zero production dependency vulnerabilities after patched gRPC override |
| Git ignore check | Local env, tools, exports and dependencies correctly ignored |
| Visual review | Mobile consent and desktop/mobile review screenshots inspected; readable, no clipping observed |

Security coverage includes unauthorized/other-user access, non-anonymous identities, all submission/meal read denials, receipt privacy, update/delete/repeat-write denial, age 15/fractional rejection, ages 16–17 closed by default, approved versus expired guardian grants, age 101 acceptance, unknown fields, malformed and last-position entries, incomplete atomic batches, disabled collection, and maximum bounded custom-food payloads in all four meals.

Browser coverage includes exactly two nutritional sex options, age 71, profile fields, refresh/draft recovery, local-name search via keyboard, fractional quantities, edit/save, custom foods, explicit meal skips, review/edit navigation, acknowledgement, emulator-confirmed submission, an explicit service retry returning the same receipt, draft deletion, mobile overflow check, and blocked underage/fractional/unapproved-minor flows.

Python coverage includes reconciliation/provenance, unknown serving weights, duplicate codes, missing serving nutrients, preservation of age/sex, malformed-record rejection, CSV formula neutralization, and a version/code/unit/name join with an independently checked serving-energy multiplication. Custom food nutrients remain blank.

Two functional issues were caught and corrected during validation: Firestore's expression budget required four separately validated meal documents in one atomic submission, bounded at eight entries each; a refresh loading race required disabling Begin until policy/catalog loading completes. Test locator errors and a test type mismatch were also corrected.

## Remaining operational work

- No live Firebase submission was made, and no production rules/settings were changed. Enable/verify Anonymous Authentication, deploy rules, and create the real `study/config` with approved institution/contact/retention/withdrawal/ethics information before recruitment.
- Minor collection remains disabled until institution approval, age-appropriate assent and guardian process are configured and grants are verified by authorized staff. The external guardian verification procedure itself must be supplied by the institution.
- No GitHub repository target was supplied and no site was published. Follow GITHUB_DEPLOYMENT.md to push, configure Pages/Actions variables, pass CI and dispatch deployment.
- App Check requires an institution-approved provider and its configuration; it is documented but not falsely marked enabled.
- Vite reports a large shared Firebase bundle (approximately 987 KB uncompressed, 261 KB gzip). The build passes. Further splitting is a performance option, not a correctness claim.
- These browser tests use synthetic data and local emulators. They do not establish approval, real participant eligibility, a live backend connection, or full assistive-technology certification.

The project-local Java and Chromium downloads are in ignored `.tools/`. For this machine's emulator tests in PowerShell, prepend `.tools/jdk-21.0.12.1+1-jre/bin` to PATH and set PLAYWRIGHT_BROWSERS_PATH to the absolute `.tools/browsers` path, or install Java/Chromium normally using the README commands.
