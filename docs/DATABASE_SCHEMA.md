# Schema version 2

`submissions/{anonymousUid}` is create-only through an atomic batch: profile metadata, one to eight private occasion documents at `submissions/{uid}/meals/{mealId}`, and `receipts/{anonymousUid}` (3–10 writes). Every occasion listed in `mealOrder` and the receipt must be created with the parent. No partial or later meal writes are accepted. ID and owner both equal Firebase anonymous UID. Server timestamps record creation and consent at submission. Participants cannot retrieve the submission, including their own.

| Field | Shape |
| --- | --- |
| `responseId`, `ownerUid` | Anonymous UID, no sequence or public counter |
| `schemaVersion` | Integer 3 for new responses; legacy version 2 remains readable by exports and accepted by rules |
| `catalogVersion` | Hash-derived immutable import version |
| `createdAt` | Server timestamp |
| `consent` | `read=true`, `voluntary=true`, version, server timestamp, assent boolean, assentVersion, guardianConsentVersion |
| `profile` | Integer age ≥16, sex `male`/`female`, heightCm 80–250, weightKg 20–350, goal, diet, avoided array, otherAvoided, optional pattern/activity encoded as empty string |
| `dayRepresentativeness` | Very typical / Mostly typical / Somewhat typical / Unusual |
| `dayType` | Typical weekday / Typical weekend / Both are similar |
| `mealOrder` | Unique ordered list of 1–8 IDs from breakfast/lunch/snacks/dinner/extra1/extra2/extra3/extra4 |
| meals subcollection | Exactly the documents listed in mealOrder, created in the same batch |
| `accurate` | true, review acknowledgement |

Each occasion has a participant-editable `label` (1–80 characters), server `createdAt`, `skipped` and `entries` (0–8). IDs are stable storage slots: after a rename, the ID does not imply meal type; use the label and order for analysis. A skipped occasion must have no foods; other occasions must have at least one. Entries retain `source`, `foodCode`, `name`, `unit`, and finite quantity >0 and ≤100, except CUSTOM entries in `g` or `ml`, which allow up to 10,000. These are technical bounds, not recommendations for intake. INDB codes are original strings. CUSTOM codes are null and have bounded brand/preparation strings. No nutrients are stored in participant documents.

Version 2 records retain their original four documents without labels or mealOrder. The exporter reads both formats without modifying stored records. Version 3 exports add `meal_count`, `meal_order` and JSON `meal_labels` to participants, and zero-based `meal_index` plus `meal_label` to food/custom logs. The original `meal` column remains the stable document ID. Legacy records use the original category names as labels. The nutrition join carries these columns through unchanged. Old browser drafts are upgraded in memory with their foods retained and review confirmation reset; the existing draft storage key is retained for migration.

Text and nested structure limits in rules bound the maximum payload far below Firestore's 1 MiB document limit. There are no unrestricted client maps or unchecked food positions. CSV preserves response identifiers, lowercase sex, unrestricted upper age, meal, serving unit, source, catalog and consent/assent versions. Do not relabel sex as gender identity in research analyses.

`receipts/{uid}` has only responseId and createdAt. Only its authenticated anonymous owner may get it; listing and mutations are forbidden. It is created atomically with the submission. A confirmed receipt means the same account already submitted, and a second tab cannot overwrite that response. Keep receipts when withdrawing research answers to prevent accidental re-submission, unless the institution explicitly directs otherwise.

`study/config` is a publicly readable singleton, administrator-written only, following `study-config.example.json`. It contains public participant information, not secrets.

`minorEligibility/{uid}` is administrator-written only, with `approved`, `approvalReference`, `assentVersion`, `guardianConsentVersion`, and timestamp `expiresAt`. Only the same anonymous account can get it. This is a verification marker; actual guardian evidence belongs in the institution's approved restricted process, outside this questionnaire. Never add names or guardian contacts to public policy.
