import {
  blankDraft,
  mealKeys,
  mealLabels,
  mealOrderSchema,
  type Draft,
} from "./model";
import { z } from "zod";
import { entrySchema, profileSchema } from "./model";
export const DRAFT_KEY = "everyday-diet-study:draft:v2";
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const stored = z
  .object({
    expires: z.number(),
    draft: z
      .object({
        schemaVersion: z.literal(3),
        catalogVersion: z.string(),
        accurate: z.boolean(),
        dayRepresentativeness: z.string(),
        dayType: z.string(),
        profile: profileSchema.innerType().partial(),
        consent: z
          .object({
            read: z.boolean(),
            voluntary: z.boolean(),
            version: z.string(),
            assent: z.boolean(),
            assentVersion: z.string(),
            guardianConsentVersion: z.string(),
          })
          .strict(),
        mealOrder: mealOrderSchema,
        meals: z.record(
          z
            .object({
              label: z.string().max(80),
              skipped: z.boolean(),
              entries: z.array(entrySchema).max(8),
            })
            .strict(),
        ),
      })
      .strict()
      .refine(
        (d) =>
          Object.keys(d.meals).length === d.mealOrder.length &&
          d.mealOrder.every((id) => id in d.meals),
      ),
  })
  .strict();
export function readDraft(storage?: Storage, now = Date.now()): Draft {
  try {
    storage ??= localStorage;
    const raw = JSON.parse(storage.getItem(DRAFT_KEY) || "null");
    if (raw?.draft?.schemaVersion === 2) {
      raw.draft.schemaVersion = 3;
      raw.draft.accurate = false;
      raw.draft.mealOrder = [...mealKeys];
      raw.draft.meals = Object.fromEntries(
        mealKeys.map((key) => [
          key,
          {
            ...raw.draft.meals[key],
            label: key === "snacks" ? "Snacks & Beverages" : mealLabels[key],
          },
        ]),
      );
    }
    const value = stored.parse(raw);
    if (
      value.expires <= now ||
      value.expires > now + RETENTION_MS ||
      typeof value.draft.profile.age !== "number" ||
      value.draft.profile.age < 18
    ) {
      storage?.removeItem(DRAFT_KEY);
      return blankDraft();
    }
    return value.draft as Draft;
  } catch {
    try {
      storage?.removeItem(DRAFT_KEY);
    } catch {
      /* storage may be disabled */
    }
    return blankDraft();
  }
}
export function saveDraft(
  draft: Draft,
  storage: Storage = localStorage,
  now = Date.now(),
) {
  // Minors' answers remain in memory only. No storage before adult consent.
  if (
    !draft.consent.voluntary ||
    !draft.consent.read ||
    !draft.profile.age ||
    draft.profile.age < 18
  ) {
    storage.removeItem(DRAFT_KEY);
    return;
  }
  let expires = now + RETENTION_MS;
  try {
    const old = JSON.parse(storage.getItem(DRAFT_KEY) || "null");
    if (old?.expires > now) expires = old.expires;
  } catch {
    /* replace corrupt draft */
  }
  storage.setItem(DRAFT_KEY, JSON.stringify({ expires, draft }));
}
