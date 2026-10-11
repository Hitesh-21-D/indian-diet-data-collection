import { describe, expect, it } from "vitest";
import {
  ageSchema,
  eligibilityError,
  entrySchema,
  mealSchema,
  profileSchema,
  quantitySchema,
  responseSchema,
  searchFoods,
  validateCatalogEntries,
  type Catalog,
} from "../../src/model";
import { readDraft, saveDraft, RETENTION_MS } from "../../src/draft";
import { policy, response } from "../fixtures";
import catalogJson from "../../public/data/indb_food_catalog.json";
const catalog = catalogJson as Catalog;
describe("age and nutritional sex field", () => {
  it.each([16, 17, 18, 71, 120, 200])(
    "accepts whole age %s without a maximum",
    (n) => expect(ageSchema.safeParse(n).success).toBe(true),
  );
  it.each([15, 0, -1, 16.5, NaN, Infinity, "18"])(
    "rejects invalid age %s",
    (n) => expect(ageSchema.safeParse(n).success).toBe(false),
  );
  it("permits only lowercase male and female", () => {
    for (const sex of ["male", "female"])
      expect(
        profileSchema.safeParse({ ...response().profile, sex }).success,
      ).toBe(true);
    for (const sex of ["Male", "other", "prefer_not_to_answer", ""])
      expect(
        profileSchema.safeParse({ ...response().profile, sex }).success,
      ).toBe(false);
  });
  it("blocks minors unless policy and independent guardian grant are ready", () => {
    expect(eligibilityError(16, policy, true)).toContain("not open");
    const enabled = {
      ...policy,
      minorsEnabled: true,
      minorApprovalReference: "test",
      minorAssentVersion: "a1",
      guardianConsentVersion: "g1",
      minorProcedure: "Synthetic procedure",
    };
    expect(eligibilityError(17, enabled, false)).toContain("guardian");
    expect(eligibilityError(16, enabled, true)).toBeNull();
    expect(eligibilityError(99, policy, false)).toBeNull();
  });
});
describe("foods and meals", () => {
  it.each([0.01, 0.25, 0.75, 1.33, 100])("accepts quantity %s", (n) =>
    expect(quantitySchema.safeParse(n).success).toBe(true),
  );
  it.each([0, -1, 100.1, NaN, Infinity])("rejects quantity %s", (n) =>
    expect(quantitySchema.safeParse(n).success).toBe(false),
  );
  it("searches real names and local aliases without changing food codes", () => {
    expect(
      searchFoods(catalog.foods, "garam CHAI").some(
        (f) => f.foodCode === "ASC001",
      ),
    ).toBe(true);
    expect(searchFoods(catalog.foods, "dahi").length).toBeGreaterThan(0);
    expect(searchFoods(catalog.foods, "zzzzunknown")).toHaveLength(0);
  });
  it("requires explicit skip and disallows food alongside skip", () => {
    expect(mealSchema.safeParse({ skipped: false, entries: [] }).success).toBe(
      false,
    );
    expect(mealSchema.safeParse({ skipped: true, entries: [] }).success).toBe(
      true,
    );
    expect(
      mealSchema.safeParse({
        skipped: true,
        entries: response().meals.breakfast.entries,
      }).success,
    ).toBe(false);
  });
  it("requires custom description and forbids invented code", () => {
    const food = {
      source: "CUSTOM",
      foodCode: null,
      name: "Homemade drink",
      quantity: 0.75,
      unit: "cup",
      brand: "",
      preparation: "",
    };
    expect(entrySchema.safeParse(food).success).toBe(true);
    expect(entrySchema.safeParse({ ...food, foodCode: "FAKE" }).success).toBe(
      false,
    );
    expect(entrySchema.safeParse({ ...food, unit: "" }).success).toBe(false);
  });
  it("validates catalog identity, review confirmation and bounded content", () => {
    expect(responseSchema.safeParse(response()).success).toBe(true);
    expect(() => validateCatalogEntries(response(), catalog)).not.toThrow();
    const tampered = response();
    tampered.meals.breakfast.entries[0].unit = "grams";
    expect(() => validateCatalogEntries(tampered, catalog)).toThrow();
    expect(
      responseSchema.safeParse({ ...response(), accurate: false }).success,
    ).toBe(false);
    expect(
      entrySchema.safeParse({
        ...response().meals.breakfast.entries[0],
        extra: "x",
      }).success,
    ).toBe(false);
  });
});
describe("draft retention", () => {
  function storage() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        m.set(k, v);
      },
      removeItem: (k: string) => {
        m.delete(k);
      },
    } as Storage;
  }
  it("restores adults, expires fixed retention, never saves minors", () => {
    const s = storage();
    saveDraft(response(), s, 100);
    expect(readDraft(s, 101).profile.age).toBe(24);
    saveDraft(response(), s, 1000);
    expect(readDraft(s, 100 + RETENTION_MS).profile.age).toBeUndefined();
    saveDraft(
      { ...response(), profile: { ...response().profile, age: 16 } },
      s,
      100,
    );
    expect(readDraft(s, 101).profile.age).toBeUndefined();
  });
});
