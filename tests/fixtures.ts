import { blankDraft, type ResponseData, type StudyPolicy } from "../src/model";
export const policy: StudyPolicy = {
  collectionEnabled: true,
  minorsEnabled: false,
  institution: "Synthetic test institution",
  contactEmail: "research@example.org",
  consentVersion: "test-consent-v1",
  retention: "Synthetic data only",
  withdrawal: "Contact the synthetic test team with your reference.",
  ethicsStatus: "TEST ONLY: no real approval is asserted.",
  minorApprovalReference: "",
  minorAssentVersion: "",
  guardianConsentVersion: "",
  minorProcedure: "",
  catalogVersion: "indb-65f91911de09ebdb-serving-v2",
};
export function response(): ResponseData {
  return {
    ...blankDraft(),
    schemaVersion: 2,
    catalogVersion: policy.catalogVersion,
    profile: {
      age: 24,
      sex: "male",
      heightCm: 170,
      weightKg: 65,
      goal: "Weight maintenance",
      diet: "Vegetarian",
      avoided: ["None"],
      otherAvoided: "",
      pattern: "",
      activity: "",
    },
    consent: {
      read: true,
      voluntary: true,
      version: policy.consentVersion,
      assent: false,
      assentVersion: "",
      guardianConsentVersion: "",
    },
    dayRepresentativeness: "Very typical",
    dayType: "Typical weekday",
    accurate: true,
    meals: {
      breakfast: {
        skipped: false,
        entries: [
          {
            source: "INDB",
            foodCode: "ASC001",
            name: "Hot tea (Garam Chai)",
            unit: "tea cup",
            quantity: 1.25,
          },
        ],
      },
      lunch: { skipped: true, entries: [] },
      snacks: { skipped: true, entries: [] },
      dinner: { skipped: true, entries: [] },
    },
  };
}
