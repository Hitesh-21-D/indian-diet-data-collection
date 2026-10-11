# Firebase and participant information

1. Use the supplied Firebase project or your institution's chosen project. Enable **Anonymous** in Authentication → Sign-in method. Create Cloud Firestore in the approved region and retention arrangement.
2. Set all six `.env.example` web values in ignored `.env.local`. The provided firebase-config.txt was read and translated locally. No Admin SDK key was supplied or embedded.
3. Sign in to Firebase CLI with a deployment account. Run `npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`. Deploy and verify these rules before opening collection.
4. In the Firebase console create `study/config` from `study-config.example.json`. Replace empty fields with actual approved institution, contact email, retention, withdrawal procedure, ethics status, and versioned consent information. Use the current import catalogVersion. Keep collectionEnabled=false until the approved procedure and access checks are ready. Set true to open adult collection.
5. Add the Pages hostname under Authentication authorized domains where required. Do not assume a local successful build validates the live backend.

## Ages 16–17: closed by default

Do not set minorsEnabled until the institution has approved participation and configured its actual process. The server additionally requires nonempty minorApprovalReference, minorAssentVersion, guardianConsentVersion and minorProcedure. The latter is displayed to participants and must explain age-appropriate information, the approved guardian workflow, how verification occurs and how to contact the team. If the approved process requires a separate full document, include its location in the procedure text and ensure the participant has access before verification.

When these are configured, a minor can obtain an anonymous process reference with “Check guardian consent status.” They complete the institution's guardian process externally. An authorized researcher verifies that evidence and creates `minorEligibility/{reference}` with:

```text
approved: true (boolean)
approvalReference: exactly the configured minorApprovalReference
assentVersion: exactly the configured minorAssentVersion
guardianConsentVersion: exactly the configured guardianConsentVersion
expiresAt: a future Firestore Timestamp according to the approved policy
```

No participant client can create or amend this grant. The participant refreshes their status, reads the information and voluntarily assents before proceeding. Server rules recheck the unexpired grant at final submission. Disabling minor participation immediately blocks new minor writes. A checkbox alone is not guardian consent. This generic verification adapter requires the actual institution-approved external process; it is not an electronic-signature or guardian-identity system.

Minors' profile and food responses are never written to local drafts. Their age eligibility input and consent check state exist in memory during screening. No profile step opens while minor participation is disabled. Anonymous UID is a technical identifier and must be covered by the information statement.

## Local emulator

Install Java 21+, then run `npx firebase emulators:start --project demo-diet-study --only firestore,auth`. In another terminal run `node scripts/seed_emulator.mjs`, set VITE_USE_EMULATORS=true with the demo project web values, and start Vite. The seed helper only targets loopback and a fixed demo ID. Never copy the synthetic test institution into real policy. Browser tests inject the demo environment themselves.

## Researcher export credentials

Use a restricted workstation and Application Default Credentials authorized for the intended project. `GOOGLE_APPLICATION_CREDENTIALS`, if needed, points to a key outside the repository. Prefer managed short-lived credentials over long-lived key files. `python scripts/export_firestore.py --project YOUR_PROJECT_ID` uses Admin privileges, bypassing client rules; constrain IAM and export-file access accordingly.

## Optional abuse controls

Evaluate Firebase App Check for web with the institution's approved provider and privacy notice. Register the web app, initialize App Check in the frontend with its public provider key, monitor metrics, test legitimate browsers, then enforce it for Firestore. This implementation does not pretend App Check is configured without real provider details. It is additional abuse mitigation, never a substitute for rules. Consider recruitment controls, usage monitoring and budget alerts. Anonymous authentication is not one-person-one-response enforcement.
