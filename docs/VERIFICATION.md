# Implementation verification — 10 October 2026

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
