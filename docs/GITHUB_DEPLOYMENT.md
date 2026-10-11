# GitHub Pages deployment

The deliverable is a local project. No GitHub account/repository target was provided, and no site was published during creation.

1. Create the desired GitHub repository and push the **contents of indian-diet-data-collection as the repository root**. If keeping this folder in a larger repository, adapt Actions working directories and artifact paths. Do not push `.env.local`, raw private files, service-account keys or exports.
2. Add the six VITE_FIREBASE_* values as Actions repository **variables**. These Firebase web settings are public client identifiers, not Admin credentials. Never use a server key as a Vite variable.
3. Deploy Firestore rules and configure Firebase separately. Add the host domain as appropriate and keep collection closed until approved information is in place.
4. In Settings → Pages choose GitHub Actions. Let **Verify study** pass, then manually run **Deploy GitHub Pages**.
5. The workflow computes `VITE_BASE_PATH=/<repository-name>/`. For a username.github.io repository or custom-domain root, change it to `/`. It does not hardcode a username. No router is needed, so nested-route 404 fallbacks are unnecessary.
6. Check the returned Pages URL on desktop/mobile and test the production backend with an explicitly authorized test protocol before inviting participants. Review Firebase domain, rules, policy versions and App Check if enforced.

Only `dist/` is uploaded. Python, internal nutrition CSVs, reports, credentials and participant exports are not in the static bundle. The food search JSON is public by design; confirm dataset redistribution permissions through the institution before publishing. Remove the optional Google Fonts import or self-host fonts if institutional requirements prohibit those requests.

Rules deployment is intentionally separate; frontend publication never changes database permissions. GitHub public repository visibility also exposes tracked internal nutrition catalogs, so choose repository access according to dataset terms even though Pages only publishes dist.
