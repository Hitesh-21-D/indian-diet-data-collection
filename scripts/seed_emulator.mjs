// Synthetic policy only. Hardcoded demo project and loopback prevent production use.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
const env = await initializeTestEnvironment({
  projectId: "demo-diet-study",
  firestore: {
    host: "127.0.0.1",
    port: 8080,
    rules: readFileSync("firestore.rules", "utf8"),
  },
});
const catalog = JSON.parse(
  readFileSync("public/data/indb_food_catalog.json", "utf8"),
);
await env.withSecurityRulesDisabled((c) =>
  setDoc(doc(c.firestore(), "study", "config"), {
    collectionEnabled: true,
    minorsEnabled: false,
    institution: "Synthetic test institution",
    contactEmail: "research@example.org",
    consentVersion: "test-consent-v1",
    retention: "Synthetic data only",
    withdrawal: "Contact the synthetic team with your reference.",
    ethicsStatus: "TEST ONLY. No real approval asserted.",
    minorApprovalReference: "",
    minorAssentVersion: "",
    guardianConsentVersion: "",
    minorProcedure: "",
    catalogVersion: catalog.version,
  }),
);
await env.cleanup();
console.log("Seeded loopback demo emulator only.");
