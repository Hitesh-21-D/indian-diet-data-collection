# Schema version 2

`submissions/{anonymousUid}` is create-only through a six-document atomic batch: profile metadata, four private meal documents at `submissions/{uid}/meals/{mealName}`, and `receipts/{anonymousUid}`. All four meals and the receipt must be created with the parent. No partial or later meal writes are accepted. ID and owner both equal Firebase anonymous UID. Server timestamps record creation and consent at submission. Participants cannot retrieve the submission, including their own.

| Field | Shape |
| --- | --- |
| `responseId`, `ownerUid` | Anonymous UID, no sequence or public counter |
| `schemaVersion` | Integer 2 |
| `catalogVersion` | Hash-derived immutable import version |
| `createdAt` | Server timestamp |
| `consent` | `read=true`, `voluntary=true`, version, server timestamp, assent boolean, assentVersion, guardianConsentVersion |
| `profile` | Integer age ≥16, sex `male`/`female`, heightCm 80–250, weightKg 20–350, goal, diet, avoided array, otherAvoided, optional pattern/activity encoded as empty string |
| `dayRepresentativeness` | Very typical / Mostly typical / Somewhat typical / Unusual |
| `dayType` | Typical weekday / Typical weekend / Both are similar |
| meals subcollection | Exactly breakfast/lunch/snacks/dinner documents in the same batch |
| `accurate` | true, review acknowledgement |

Each meal has a server `createdAt`, `skipped` and `entries` (0–8). A skipped meal must have no foods; a non-skipped meal must have at least one. Each entry stores `source`, `foodCode`, `name`, `unit`, and finite quantity >0 and ≤100. INDB codes are original strings. CUSTOM codes are null and have optional brand and preparation encoded as bounded strings. No nutrition values are stored in participant documents. Custom foods are represented once inside meals, then flattened to their own export.

Text and nested structure limits in rules bound the maximum payload far below Firestore's 1 MiB document limit. There are no unrestricted client maps or unchecked food positions. CSV preserves response identifiers, lowercase sex, unrestricted upper age, meal, serving unit, source, catalog and consent/assent versions. Do not relabel sex as gender identity in research analyses.

`receipts/{uid}` has only responseId and createdAt. Only its authenticated anonymous owner may get it; listing and mutations are forbidden. It is created atomically with the submission. A confirmed receipt means the same account already submitted, and a second tab cannot overwrite that response. Keep receipts when withdrawing research answers to prevent accidental re-submission, unless the institution explicitly directs otherwise.

`study/config` is a publicly readable singleton, administrator-written only, following `study-config.example.json`. It contains public participant information, not secrets.

`minorEligibility/{uid}` is administrator-written only, with `approved`, `approvalReference`, `assentVersion`, `guardianConsentVersion`, and timestamp `expiresAt`. Only the same anonymous account can get it. This is a verification marker; actual guardian evidence belongs in the institution's approved restricted process, outside this questionnaire. Never add names or guardian contacts to public policy.
