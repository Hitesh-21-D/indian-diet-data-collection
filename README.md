# Everyday Diet Study

A responsive research questionnaire for **A Knowledge-Grounded Multi-Objective AI Framework for Personalized Nutritional Optimization of Indian Diets**. It collects de-identified profile information and a typical full day of eating for baseline dietary memory. It does not recommend diets, show nutrient totals, or run optimization algorithms.

## Start locally

Requirements: Node.js 22+, npm, Python 3.10+ with `requirements.txt`; Java 21+ for Firebase emulators.

```sh
npm ci
cp .env.example .env.local
# Fill Firebase web configuration (the supplied configuration is already in the local .env.local).
npm run dev
```

Open the printed local URL. The real study stays closed until Firestore `study/config` has complete approved participant information. Missing config produces a recoverable setup message, not a fake success. See [Firebase setup](docs/FIREBASE_SETUP.md). A loopback emulator supports the complete synthetic questionnaire without changing production.

## Implemented experience

Consent and age screening → profile → separate eating occasions → typical-day questions → review → confirmed submission. Dietary pattern initially creates 2, 3, 4, or 5 occasions; an unspecified/variable pattern starts with four. Meal names are read-only. Participants can remove occasions and use **Add another meal** after the last one, up to eight occasions with eight foods each (64 total). Changing the dietary pattern preserves occasions containing entered foods or an explicit skip. Instructions appear before the first food entry; questions about representativeness come after all meals. Food autocomplete supports keyboard/touch selection, original recipe names, grounded aliases, fractional quantities, editing, removal, explicit skipping and custom descriptions. All-skipped days remain possible and require research quality review.

Age is an integer **16 or greater, with no fixed upper limit**. Ages 16–17 are blocked until the institution configures its approval, age-appropriate assent, guardian consent procedure, and a verified guardian-consent grant for that anonymous account. A participant checkbox cannot bypass this gate. No university or ethics approval is invented.

The exact field is **Sex (for nutritional estimation)**, with only Male/Female, stored as `male`/`female`. It supports the existing sex-specific nutritional calculation and is **not a comprehensive measure of gender identity**. This survey performs no metabolic calculation itself.

Consenting adults' drafts expire seven days from first save, without extending on each edit. They are cleared after a server-confirmed response and can be discarded with confirmation. Minors' answers stay in memory and are lost on refresh; the page explains this. Anonymous Firebase authentication persists a technical identifier separately to enable retries. No server secrets are stored in the browser.

## Architecture and files

React 19 + TypeScript + Vite, clean responsive CSS, Lucide, Zod validation, modular Firebase SDK, Firestore and anonymous authentication. GitHub Pages serves the static frontend. Python handles offline data import and privileged export.

| Location | Purpose |
| --- | --- |
| `src/App.tsx`, `src/FoodEditor.tsx`, `src/styles.css` | Questionnaire, food entry, responsive design |
| `src/model.ts`, `src/draft.ts`, `src/firebase.ts` | Schema, validation, local retention, safe writes |
| `public/data/indb_food_catalog.json` | Search-only public catalog, no nutrients |
| `data/processed/` | Immutable versioned catalog snapshots and per-serving nutrition |
| `data/reports/` | Import manifest and row-level exclusions |
| `scripts/` | Workbook import, privileged export, strict nutrition join, pipeline tests |
| `tests/` | Unit, security emulator and desktop/mobile browser tests |
| `firestore.rules`, `firebase.json` | Server enforcement and emulator configuration |
| `.github/workflows/` | CI and manually triggered Pages deployment |
| `docs/` | Schema, research pipeline, setup, deployment, security |

## Real INDB import

The supplied file was `INDB.xlsx` at the user-designated input location, not a file named `INDB(1).xlsx`. Inspection confirmed `Nutrient Data`, 1,014 records, and 82 columns. Its SHA-256 is recorded in `data/reports/indb_import_report.json`. Import generated **917 included foods and 97 excluded rows**, rather than forcing the earlier approximate 818-record pilot count.

```sh
python -m pip install -r requirements.txt
python scripts/import_indb.py /path/to/INDB.xlsx
```

All six nutrients use `unit_serving_*`. A valid serving label and all six finite, nonnegative values are required; zero is valid. Missing data are reported, never imputed. The 97 exclusions have invalid/missing serving labels; 82 also lack the six serving nutrient values. Original codes and distinct recipes are retained. Conflicting duplicate codes are excluded for review, never merged by name. No duplicate codes occurred in this workbook.

Serving weight is unknown. `servings_unit` is a label, never a gram conversion. Unqualified nutrient columns are not used because their basis was not independently established from workbook metadata. Keep the raw workbook in controlled research storage and preserve versioned outputs on each re-import. See [research data pipeline](docs/RESEARCH_DATA_PIPELINE.md).

## Testing and builds

```sh
npm run typecheck
npm run lint
npm test
python scripts/test_pipeline.py
npm run build
npm run test:rules
npx playwright install chromium webkit
npx firebase emulators:exec --project demo-diet-study --only firestore,auth "node scripts/seed_emulator.mjs && npm run test:browser"
```

The browser suite launches Vite with a hardcoded demo Firebase project and local emulators. Do not point tests at production. Security tests include unauthorized operations, minor eligibility, malformed nested values, maximum document size, duplicate writes, and private receipts. See `docs/VERIFICATION.md` for actual checks from this implementation session.

## Researcher export

Use Application Default Credentials for a least-privilege researcher account; never put Admin SDK credentials in Vite variables or Git. Exports remain ignored.

```sh
python scripts/export_firestore.py --project YOUR_PROJECT_ID --output exports
python scripts/join_nutrition.py exports/food_logs.csv data/processed/indb_nutrition.csv exports/nutrient_logs.csv
```

Outputs include participants, food logs, custom foods and rejected-record diagnostics. Nutrition joins require both original code and catalog version, plus matching unit/name. Unmatched/custom foods remain unknown. Preserve raw logs for review and never count missing nutrients as zero. See [database schema](docs/DATABASE_SCHEMA.md).

## Deploy and operate

Follow [Firebase setup](docs/FIREBASE_SETUP.md) and [GitHub Pages deployment](docs/GITHUB_DEPLOYMENT.md). Use the [study operating guide](docs/RUNNING_THE_STUDY.md) for exports, withdrawals and pausing collection. Deploy rules separately from the frontend. The frontend build cannot publish Firestore rules or enable authentication. Complete CI before triggering Pages. `.env.local` contains public Firebase web configuration and is intentionally ignored. Public web config is not an administrative credential.

## Privacy, security and limitations

See [security](docs/SECURITY.md). Participant submissions cannot be read, listed, updated, or deleted by clients. A separate own-only receipt supports idempotent retries without revealing answers. The dataset is de-identified, not guaranteed anonymous. Anonymous authentication does not stop a human from making several accounts. Rules cannot independently verify age, honesty, serving accuracy or INDB membership; canonical export joins quarantine unmatched catalog entries. Recruitment controls, App Check, monitoring and an approved consent process remain operational responsibilities.

This implementation does not assert that local ethical requirements are satisfied. The institution must approve the configured process and provide real participant-facing information before collection. Adult local drafts remain on shared devices until deletion or expiry on next visit. The application uses externally hosted optional Google Fonts with local fallbacks; self-host or remove the font import if the institution requires no font-provider network requests.

## Troubleshooting

- Setup error: fill `.env.local`, restart Vite, deploy rules, and configure `study/config` with valid strings and the current catalog version.
- Permission denied: verify Anonymous Authentication, deployed rules, `collectionEnabled`, current consent version, and minor eligibility if applicable.
- Cannot resume on another device: drafts and anonymous identity are browser-specific. No cross-device resume is promised.
- Write uncertain/offline: retain the tab and retry. Success appears only after server acknowledgement or a confirmed own receipt.
- Emulator won't start: install Java 21+, check ports 8080 and 9099, and use `demo-diet-study`.
- Pages assets missing: set `VITE_BASE_PATH` to `/REPOSITORY/`, or `/` for a user-site/custom domain.
- Import failed: inspect exact sheet and required column names. Do not rename mappings speculatively or fabricate values.
