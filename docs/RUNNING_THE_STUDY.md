# Running the adult study

The active configuration on 11 October 2026 is adult-only: `collectionEnabled=true`, `minorsEnabled=false`. The database is `indian-diet-research`, region `asia-south1` (Mumbai). Keep the institution's ethics clearance and approved participant information with the study records. This technical audit does not independently validate that document.

## Before recruitment

For the separate-occasion update, first deploy the backward-compatible rules with `npx firebase deploy --only firestore:rules --project indian-diet-research`. Then push the fixes, wait for **Verify study**, and manually run **Deploy GitHub Pages** on `main`. Open the deployed questionnaire on the phones you expect participants to use. Browser automation covers Chromium and WebKit at desktop, tablet and phone sizes, including 320 CSS pixels; it cannot simulate every physical keyboard or device setting.

Use the final study URL: https://hitesh-21-d.github.io/indian-diet-data-collection/. Invite adults aged 18 and above. Use only the consent wording, indefinite retention and seven-day withdrawal procedure covered by your approved protocol. Collection for ages 16–17 remains closed. Preserve the original workbook, exclusion report, catalog version and consent versions for reproducibility.

## Export responses

Run these commands from the `indian-diet-data-collection` project folder in PowerShell. Your previously configured Application Default Credentials must belong to an authorized researcher.

```powershell
$exportFolder = "exports\$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
py scripts/export_firestore.py --project indian-diet-research --output $exportFolder
Invoke-Item $exportFolder
```

Each run creates a full snapshot, not only newly submitted responses. Do not concatenate snapshots without deduplicating `response_id`. Zero rejected rows is the normal export result. Inspect `export_errors.csv` when rejected is nonzero. Review `custom_foods.csv` and implausible/all-skipped days before analysis. Custom foods have unknown nutrients, not zero nutrients.

For a serving-based nutrient join:

```powershell
py scripts/join_nutrition.py "$exportFolder\food_logs.csv" data/processed/indb_nutrition.csv "$exportFolder\nutrient_logs.csv"
```

Keep snapshots in institution-approved, access-controlled storage. `exports/` is excluded from Git, but that is not encryption or a backup. Take a regular protected backup during collection. Never put exports or researcher credentials in `public/`, GitHub, email attachments to unauthorized recipients, or frontend settings.

## Withdrawal requests

Monitor both study contact mailboxes. For a request within seven days, use the supplied response reference to identify the exact record and check its `createdAt` timestamp. Never ask participants to put their names or medical information in the survey.

An authorized researcher should delete **all** that reference's occasion documents under `submissions/{reference}/meals` (1–8 for version 3, four for legacy records), then the parent `submissions/{reference}`, and its `receipts/{reference}` document. A parent deletion alone does not delete subcollections. Also remove the reference from retained exports, joined analysis files and backups according to the approved procedure. Keep a minimal restricted processing log outside the public repository. Do not delete any other participant's record.

## Monitor or pause collection

Review submission counts, failed submissions and Firestore usage regularly during recruitment. Participants can stop before submission. After a successful submission, reopening the same browser restores its own response receipt; it does not open a new questionnaire. Browser storage clearing can create a new anonymous account, so this is not proof of unique identity.

To pause new submissions, change **only** `study/config.collectionEnabled` to `false` in Firestore. The server rules enforce the pause even for already-open questionnaires. Set it back to `true` when the study is ready to resume. A frontend deployment is not needed for this switch.

## Known limits

- App Check is not implemented/enforced by this code. Anonymous authentication and schema rules do not eliminate automated spam. Controlled recruitment and usage monitoring remain necessary; configure and test App Check separately if required by the institution.
- Live settings include Anonymous Authentication and tested private submission rules. Browser tests use synthetic local data, not production participant records.
- Indefinite retention and ethical clearance are institution decisions; retain the actual approval and confirm the published information agrees with it.
- Dataset redistribution rights, approved recruitment and secure researcher storage remain the team's responsibility.
- Firestore point-in-time recovery and database deletion protection were disabled at audit time. Use approved protected exports; adding paid backup features is a separate choice.
