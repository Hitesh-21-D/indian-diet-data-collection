import { z } from "zod";

export const mealKeys = ["breakfast", "lunch", "snacks", "dinner"] as const;
export type MealKey = (typeof mealKeys)[number];
export const mealLabels: Record<MealKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks & Beverages",
  dinner: "Dinner",
};
export const goals = [
  "Weight loss",
  "Weight maintenance",
  "Weight gain",
] as const;
export const diets = [
  "Vegetarian",
  "Eggetarian",
  "Non-vegetarian",
  "Vegan",
] as const;
export const avoidanceOptions = [
  "Eggs",
  "Dairy",
  "Wheat/gluten",
  "Peanuts",
  "Tree nuts",
  "Seafood",
  "Other",
  "None",
] as const;
export const patterns = [
  "2 meals per day",
  "3 meals per day",
  "4 meals per day",
  "5 or more meals per day",
  "Varies",
] as const;
export const activities = [
  "Sedentary",
  "Lightly active",
  "Moderately active",
  "Very active",
  "Prefer not to answer",
] as const;
export const typicalOptions = [
  "Very typical",
  "Mostly typical",
  "Somewhat typical",
  "Unusual",
] as const;
export const dayOptions = [
  "Typical weekday",
  "Typical weekend",
  "Both are similar",
] as const;
export const ageSchema = z
  .number()
  .int("Enter a whole number.")
  .min(16, "Participants must be at least 16.")
  .finite();
export const quantitySchema = z
  .number()
  .finite()
  .gt(0, "Enter an amount greater than zero.")
  .max(100, "Use 100 units or fewer.");
const shortText = (max: number) => z.string().trim().min(1).max(max);
export const entrySchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("INDB"),
      foodCode: shortText(40),
      name: shortText(200),
      unit: shortText(80),
      quantity: quantitySchema,
    })
    .strict(),
  z
    .object({
      source: z.literal("CUSTOM"),
      foodCode: z.null(),
      name: shortText(200),
      unit: shortText(80),
      quantity: quantitySchema,
      brand: z.string().trim().max(100),
      preparation: z.string().trim().max(300),
    })
    .strict(),
]);
export type FoodEntry = z.infer<typeof entrySchema>;
export const mealSchema = z
  .object({ skipped: z.boolean(), entries: z.array(entrySchema).max(8) })
  .strict()
  .refine(
    (m) => (m.skipped ? m.entries.length === 0 : m.entries.length > 0),
    "Add a food or explicitly skip this meal.",
  );
export const profileSchema = z
  .object({
    age: ageSchema,
    sex: z.enum(["male", "female"]),
    heightCm: z.number().finite().min(80).max(250),
    weightKg: z.number().finite().min(20).max(350),
    goal: z.enum(goals),
    diet: z.enum(diets),
    avoided: z.array(z.enum(avoidanceOptions)).min(1).max(8),
    otherAvoided: z.string().trim().max(200),
    pattern: z.union([z.enum(patterns), z.literal("")]),
    activity: z.union([z.enum(activities), z.literal("")]),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      new Set(p.avoided).size !== p.avoided.length ||
      (p.avoided.includes("None") && p.avoided.length > 1)
    )
      ctx.addIssue({
        code: "custom",
        path: ["avoided"],
        message: "Choose None by itself, or select foods avoided.",
      });
    if (p.avoided.includes("Other") !== Boolean(p.otherAvoided))
      ctx.addIssue({
        code: "custom",
        path: ["otherAvoided"],
        message: "Describe Other only when it is selected.",
      });
  });
export type Profile = z.infer<typeof profileSchema>;
export const consentSchema = z
  .object({
    read: z.literal(true),
    voluntary: z.literal(true),
    version: shortText(100),
    assent: z.boolean(),
    assentVersion: z.string().max(100),
    guardianConsentVersion: z.string().max(100),
  })
  .strict();
export const responseSchema = z
  .object({
    profile: profileSchema,
    consent: consentSchema,
    dayRepresentativeness: z.enum(typicalOptions),
    dayType: z.enum(dayOptions),
    meals: z
      .object({
        breakfast: mealSchema,
        lunch: mealSchema,
        snacks: mealSchema,
        dinner: mealSchema,
      })
      .strict(),
    accurate: z.literal(true),
    catalogVersion: shortText(100),
    schemaVersion: z.literal(2),
  })
  .strict();
export type ResponseData = z.infer<typeof responseSchema>;
export type Draft = {
  profile: Partial<Profile>;
  consent: {
    read: boolean;
    voluntary: boolean;
    version: string;
    assent: boolean;
    assentVersion: string;
    guardianConsentVersion: string;
  };
  dayRepresentativeness: string;
  dayType: string;
  meals: Record<MealKey, { skipped: boolean; entries: FoodEntry[] }>;
  accurate: boolean;
  catalogVersion: string;
  schemaVersion: 2;
};
export function blankDraft(): Draft {
  return {
    profile: { avoided: [], otherAvoided: "", pattern: "", activity: "" },
    consent: {
      read: false,
      voluntary: false,
      version: "",
      assent: false,
      assentVersion: "",
      guardianConsentVersion: "",
    },
    dayRepresentativeness: "",
    dayType: "",
    meals: {
      breakfast: { skipped: false, entries: [] },
      lunch: { skipped: false, entries: [] },
      snacks: { skipped: false, entries: [] },
      dinner: { skipped: false, entries: [] },
    },
    accurate: false,
    catalogVersion: "",
    schemaVersion: 2,
  };
}
export const policySchema = z
  .object({
    collectionEnabled: z.boolean(),
    minorsEnabled: z.boolean(),
    institution: shortText(200),
    contactEmail: z.string().email(),
    consentVersion: shortText(100),
    retention: shortText(500),
    withdrawal: shortText(1000),
    ethicsStatus: shortText(500),
    minorApprovalReference: z.string().max(200),
    minorAssentVersion: z.string().max(100),
    guardianConsentVersion: z.string().max(100),
    minorProcedure: z.string().max(2000),
    catalogVersion: shortText(100),
  })
  .strict();
export type StudyPolicy = z.infer<typeof policySchema>;
export function minorPolicyReady(p: StudyPolicy) {
  return (
    p.minorsEnabled &&
    [
      p.minorApprovalReference,
      p.minorAssentVersion,
      p.guardianConsentVersion,
      p.minorProcedure,
    ].every((v) => v.trim().length > 0)
  );
}
export function eligibilityError(
  age: unknown,
  p: StudyPolicy | null,
  guardianVerified: boolean,
): string | null {
  const result = ageSchema.safeParse(age);
  if (!result.success) return "Enter a whole-number age of 16 or above.";
  if (!p?.collectionEnabled) return "The study is not open for responses yet.";
  if (result.data < 18 && !minorPolicyReady(p))
    return "Participation for ages 16–17 is not open. Required ethics approval and consent procedures must be configured first.";
  if (result.data < 18 && !guardianVerified)
    return "Complete the approved guardian consent procedure before continuing.";
  return null;
}
export interface Food {
  foodCode: string;
  name: string;
  unit: string;
  aliases: string[];
  servingWeightG: null;
}
export interface Catalog {
  version: string;
  sourceSha256: string;
  foods: Food[];
}
export function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function searchFoods(foods: Food[], query: string) {
  const words = normalize(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  return foods
    .filter((f) =>
      words.every((w) =>
        normalize([f.name, ...f.aliases].join(" ")).includes(w),
      ),
    )
    .sort(
      (a, b) =>
        Number(normalize(b.name).startsWith(normalize(query))) -
          Number(normalize(a.name).startsWith(normalize(query))) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 30);
}
export function validateCatalogEntries(data: ResponseData, catalog: Catalog) {
  if (data.catalogVersion !== catalog.version)
    throw new Error("The food catalog changed. Review your foods again.");
  const byCode = new Map(catalog.foods.map((f) => [f.foodCode, f]));
  for (const m of mealKeys)
    for (const entry of data.meals[m].entries) {
      if (entry.source !== "INDB") continue;
      const food = byCode.get(entry.foodCode);
      if (!food || food.name !== entry.name || food.unit !== entry.unit)
        throw new Error(
          "A saved food no longer matches this catalog. Remove it and select it again.",
        );
    }
}
