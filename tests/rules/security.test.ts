import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { policy, response } from "../fixtures";
let env: RulesTestEnvironment;
function client(uid = "participant") {
  return env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } })
    .firestore();
}
function payload(uid = "participant") {
  const r = response();
  return {
    ...r,
    responseId: uid,
    ownerUid: uid,
    createdAt: serverTimestamp(),
    consent: { ...r.consent, timestamp: serverTimestamp() },
  };
}
function commit(
  db: ReturnType<typeof client>,
  data: Record<string, unknown> = payload(),
  uid = "participant",
) {
  const b = writeBatch(db);
  const { meals, ...metadata } = data;
  b.set(doc(db, "submissions", uid), metadata);
  for (const [name, meal] of Object.entries(meals as Record<string, object>))
    b.set(doc(db, "submissions", uid, "meals", name), {
      ...meal,
      createdAt: serverTimestamp(),
    });
  b.set(doc(db, "receipts", uid), {
    responseId: uid,
    createdAt: serverTimestamp(),
  });
  return b.commit();
}
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-diet-study",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "study", "config"), policy);
  });
});
afterAll(async () => {
  await env.cleanup();
});
describe("participant security", () => {
  it("permits measured custom quantities and rejects amounts above their unit limit", async () => {
    const data = payload();
    const food = {
      source: "CUSTOM" as const,
      foodCode: null,
      name: "Test drink",
      unit: "ml",
      quantity: 250,
      brand: "",
      preparation: "",
    };
    data.meals.breakfast.entries = [food];
    food.quantity = 10001;
    await assertFails(commit(client(), data));
    food.quantity = 250;
    food.unit = "cup";
    await assertFails(commit(client(), data));
    food.unit = "ml";
    await assertSucceeds(commit(client(), data));
  });
  it("allows one atomic anonymous submission; denies all reads, listing, mutations and repeat creates", async () => {
    const db = client();
    await assertSucceeds(commit(db));
    await assertFails(getDoc(doc(db, "submissions", "participant")));
    await assertFails(getDocs(collection(db, "submissions")));
    await assertFails(
      getDoc(doc(db, "submissions", "participant", "meals", "breakfast")),
    );
    await assertFails(
      getDocs(collection(db, "submissions", "participant", "meals")),
    );
    await assertFails(
      updateDoc(doc(db, "submissions", "participant", "meals", "breakfast"), {
        skipped: true,
      }),
    );
    await assertFails(
      updateDoc(doc(db, "submissions", "participant"), { accurate: false }),
    );
    await assertFails(deleteDoc(doc(db, "submissions", "participant")));
    await assertFails(commit(db));
    await assertSucceeds(getDoc(doc(db, "receipts", "participant")));
    await assertFails(getDoc(doc(client("other"), "receipts", "participant")));
  });
  it("rejects unauthenticated, non-anonymous and cross-owner creation", async () => {
    await assertFails(commit(env.unauthenticatedContext().firestore()));
    await assertFails(
      commit(
        env
          .authenticatedContext("participant", {
            firebase: { sign_in_provider: "password" },
          })
          .firestore(),
      ),
    );
    await assertFails(commit(client("other")));
  });
  it("rejects forged receipt and client policy/grant writes", async () => {
    const db = client();
    await assertFails(
      setDoc(doc(db, "receipts", "participant"), {
        responseId: "participant",
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(setDoc(doc(db, "study", "config"), policy));
    await assertFails(
      setDoc(doc(db, "minorEligibility", "participant"), { approved: true }),
    );
    await assertFails(setDoc(doc(db, "elsewhere", "participant"), {}));
  });
  it.each([15, 16.5])("rejects invalid age %s", async (age) => {
    const d = payload();
    d.profile.age = age;
    await assertFails(commit(client(), d));
  });
  it.each([16, 17])(
    "blocks minor age %s by default even with assent",
    async (age) => {
      const d = payload();
      d.profile.age = age;
      d.consent.assent = true;
      await assertFails(commit(client(), d));
    },
  );
  it("accepts age beyond the old maximum", async () => {
    const d = payload();
    d.profile.age = 101;
    await assertSucceeds(commit(client(), d));
  });
  it("enforces approved minor policy, grant versions and expiration", async () => {
    const enabled = {
      ...policy,
      minorsEnabled: true,
      minorApprovalReference: "ethics-test",
      minorAssentVersion: "a1",
      guardianConsentVersion: "g1",
      minorProcedure: "Test guardian consent process",
    };
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "study", "config"), enabled),
    );
    const d = payload();
    d.profile.age = 16;
    Object.assign(d.consent, {
      assent: true,
      assentVersion: "a1",
      guardianConsentVersion: "g1",
    });
    await assertFails(commit(client(), d));
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "minorEligibility", "participant"), {
        approved: true,
        approvalReference: "ethics-test",
        assentVersion: "a1",
        guardianConsentVersion: "g1",
        expiresAt: Timestamp.fromMillis(Date.now() - 10000),
      }),
    );
    await assertFails(commit(client(), d));
    await env.withSecurityRulesDisabled((c) =>
      updateDoc(doc(c.firestore(), "minorEligibility", "participant"), {
        expiresAt: Timestamp.fromMillis(Date.now() + 3600000),
      }),
    );
    for (const key of ["extra1", "extra2", "extra3", "extra4"] as const) {
      d.mealOrder.push(key);
      d.meals[key] = { label: key, skipped: true, entries: [] };
    }
    await assertSucceeds(commit(client(), d));
  });
  it("rejects unknown fields, malformed nested entries, unsupported sex and empty meals", async () => {
    await assertFails(commit(client(), { ...payload(), extra: "no" }));
    const d = payload();
    Object.assign(d.profile, { sex: "other" });
    await assertFails(commit(client(), d));
    const x = payload();
    x.meals.breakfast.entries[0].quantity = -1;
    await assertFails(commit(client(), x));
    const y = payload();
    y.meals.lunch.skipped = false;
    await assertFails(commit(client(), y));
  });
  it("rejects disabled collection and unbounded entries", async () => {
    const d = payload();
    d.meals.breakfast.entries = Array.from(
      { length: 9 },
      () => response().meals.breakfast.entries[0],
    );
    await assertFails(commit(client(), d));
    await env.withSecurityRulesDisabled((c) =>
      updateDoc(doc(c.firestore(), "study", "config"), {
        collectionEnabled: false,
      }),
    );
    await assertFails(commit(client()));
  });
  it("rejects incomplete atomic batches and unchecked nested fields", async () => {
    const incomplete = payload();
    const { breakfast, ...rest } = incomplete.meals;
    await assertFails(commit(client(), { ...incomplete, meals: rest }));
    await assertFails(
      setDoc(
        doc(client(), "submissions", "participant", "meals", "breakfast"),
        { ...breakfast, createdAt: serverTimestamp() },
      ),
    );
    const unknown = payload();
    Object.assign(unknown.meals.breakfast.entries[0], {
      dangerous: "unexpected",
    });
    await assertFails(commit(client(), unknown));
    const badLast = payload();
    badLast.meals.breakfast.entries = Array.from({ length: 8 }, () => ({
      ...response().meals.breakfast.entries[0],
    }));
    badLast.meals.breakfast.entries[7].quantity = 0;
    await assertFails(commit(client(), badLast));
  });
  it.each([
    [1, "legacy"],
    [4, "legacy"],
    [8, "legacy"],
    [8, "g"],
  ] as const)(
    "accepts maximum bounded entries across %s meals with %s units",
    async (count, unit) => {
      const d = payload();
      if (count === 8) {
        for (const key of ["extra1", "extra2", "extra3", "extra4"] as const) {
          d.mealOrder.push(key);
          d.meals[key] = { label: key, skipped: true, entries: [] };
        }
      }
      for (const m of Object.values(d.meals).slice(0, count)) {
        m.skipped = false;
        m.entries = Array.from({ length: 8 }, () => ({
          source: "CUSTOM",
          foodCode: null,
          name: "x".repeat(200),
          unit: unit === "g" ? "g" : "u".repeat(80),
          quantity: unit === "g" ? 10000 : 100,
          brand: "b".repeat(100),
          preparation: "p".repeat(300),
        }));
      }
      await assertSucceeds(commit(client(), d));
    },
  );
  it("retains schema v2 compatibility for an already-open old questionnaire", async () => {
    const d = payload();
    const legacy: Record<string, unknown> = Object.fromEntries(
      Object.entries(d).filter(([key]) => key !== "mealOrder"),
    );
    legacy.meals = Object.fromEntries(
      Object.entries(d.meals).map(([key, value]) => [
        key,
        { skipped: value.skipped, entries: value.entries },
      ]),
    );
    await assertSucceeds(commit(client(), { ...legacy, schemaVersion: 2 }));
  });
  it("rejects missing, duplicate, foreign and unlisted eating occasions", async () => {
    const d = payload();
    await assertFails(
      commit(client(), { ...d, mealOrder: [...d.mealOrder, "extra1"] }),
    );
    await assertFails(
      commit(client(), { ...d, mealOrder: ["breakfast", "breakfast"] }),
    );
    await assertFails(commit(client(), { ...d, mealOrder: ["unknown"] }));
    await assertFails(commit(client(), { ...d, mealOrder: ["breakfast"] }));
    await assertFails(commit(client(), { ...d, mealOrder: [] }));
  });
});
