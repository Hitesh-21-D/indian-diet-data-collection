import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  connectAuthEmulator,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  eligibilityError,
  mealKeys,
  policySchema,
  responseSchema,
  validateCatalogEntries,
  type Catalog,
  type Draft,
  type StudyPolicy,
} from "./model";
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
const configured = Boolean(config.apiKey && config.projectId && config.appId);
const app = configured ? initializeApp(config) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
if (env.DEV && env.VITE_USE_EMULATORS === "true" && auth && db) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
let signingIn: Promise<string> | null = null;
export async function anonymousUid(): Promise<string> {
  if (!auth)
    throw new Error(
      "Firebase configuration is missing. Please contact the study team.",
    );
  if (!signingIn)
    signingIn = (async () => {
      await setPersistence(auth, browserLocalPersistence);
      await auth.authStateReady();
      return auth.currentUser?.uid ?? (await signInAnonymously(auth)).user.uid;
    })().catch((e) => {
      signingIn = null;
      throw e;
    });
  return signingIn;
}
export async function loadPolicy(): Promise<StudyPolicy> {
  if (!db) throw new Error("The study is awaiting Firebase configuration.");
  const snapshot = await getDocFromServer(doc(db, "study", "config"));
  if (!snapshot.exists())
    throw new Error("The study is awaiting approved participant information.");
  return policySchema.parse(snapshot.data());
}
// Restore only this browser's existing server receipt; do not create an account
// merely by opening the information page.
export async function loadExistingReceipt(): Promise<string | null> {
  if (!auth || !db) return null;
  await auth.authStateReady();
  if (!auth.currentUser) return null;
  const uid = auth.currentUser.uid;
  const receipt = await getDocFromServer(doc(db, "receipts", uid));
  return receipt.exists() ? uid : null;
}
export async function checkGuardianConsent(
  policy: StudyPolicy,
): Promise<{ uid: string; verified: boolean }> {
  const uid = await anonymousUid();
  const snapshot = await getDocFromServer(doc(db!, "minorEligibility", uid));
  const grant = snapshot.data();
  return {
    uid,
    verified: Boolean(
      grant?.approved === true &&
      grant.approvalReference === policy.minorApprovalReference &&
      grant.guardianConsentVersion === policy.guardianConsentVersion &&
      grant.assentVersion === policy.minorAssentVersion &&
      grant.expiresAt?.toMillis() > Date.now(),
    ),
  };
}
export async function submitResponse(
  draft: Draft,
  catalog: Catalog,
): Promise<string> {
  const data = responseSchema.parse(draft);
  validateCatalogEntries(data, catalog);
  const policy = await loadPolicy();
  const guardian =
    data.profile.age < 18 ? await checkGuardianConsent(policy) : null;
  const error = eligibilityError(
    data.profile.age,
    policy,
    Boolean(guardian?.verified),
  );
  if (error) throw new Error(error);
  if (
    policy.catalogVersion !== data.catalogVersion ||
    data.consent.version !== policy.consentVersion
  )
    throw new Error(
      "Study information changed. Reload and review the consent information.",
    );
  if (
    data.profile.age < 18 &&
    (!data.consent.assent ||
      data.consent.assentVersion !== policy.minorAssentVersion ||
      data.consent.guardianConsentVersion !== policy.guardianConsentVersion)
  )
    throw new Error("Please review the current assent information.");
  const uid = guardian?.uid ?? (await anonymousUid());
  const receiptRef = doc(db!, "receipts", uid);
  const existing = await getDocFromServer(receiptRef);
  if (existing.exists()) return uid;
  const batch = writeBatch(db!);
  const { meals, ...metadata } = data;
  batch.set(doc(db!, "submissions", uid), {
    ...metadata,
    responseId: uid,
    ownerUid: uid,
    createdAt: serverTimestamp(),
    consent: { ...data.consent, timestamp: serverTimestamp() },
  });
  for (const key of mealKeys)
    batch.set(doc(db!, "submissions", uid, "meals", key), {
      ...meals[key],
      createdAt: serverTimestamp(),
    });
  batch.set(receiptRef, { responseId: uid, createdAt: serverTimestamp() });
  try {
    await batch.commit();
  } catch (error) {
    // A lost acknowledgement or simultaneous tab may have committed the same response.
    const receipt = await getDocFromServer(receiptRef).catch(() => null);
    if (!receipt?.exists()) throw error;
  }
  return uid;
}
