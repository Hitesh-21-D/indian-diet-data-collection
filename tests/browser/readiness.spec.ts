import { expect, test, type Page } from "@playwright/test";

async function fits(page: Page, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    name,
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}
async function begin(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Synthetic test institution")).toBeVisible({
    timeout: 15000,
  });
  await page.getByLabel("Your age in completed years").fill("24");
  await page.getByLabel("I have read the participant information.").check();
  await page.getByLabel("I voluntarily consent to participate.").check();
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
}
async function breakfast(page: Page) {
  await begin(page);
  await page.getByLabel("Female", { exact: true }).check();
  await page.getByLabel("Height (cm)").fill("160");
  await page.getByLabel("Weight (kg)").fill("55.5");
  await page
    .getByLabel("Primary dietary goal")
    .selectOption("Weight maintenance");
  await page
    .getByRole("combobox", { name: "Dietary preference", exact: true })
    .selectOption("Vegetarian");
  await page.getByLabel("None", { exact: true }).check();
  await fits(page, "profile");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Breakfast", exact: true }),
  ).toBeVisible();
  const number = page.locator(".instruction-list span").first();
  await expect(number).toHaveText("01");
  expect(await number.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe(
    "nowrap",
  );
  await fits(page, "instructions");
}

test("five or more creates five occasions, adds and removes a sixth, and submits separate meal names", async ({
  page,
}) => {
  await breakfast(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page
    .getByLabel("Dietary pattern (optional)")
    .selectOption("5 or more meals per day");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const names = [
    "Breakfast",
    "Mid-morning meal",
    "Lunch",
    "Afternoon snack",
    "Dinner",
  ];
  for (let i = 0; i < names.length; i++) {
    await expect(page.getByLabel("Meal name", { exact: true })).toHaveValue(
      names[i],
    );
    await page.getByLabel("I usually skip this meal").check();
    if (i < names.length - 1)
      await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "Add another meal", exact: true })
    .click();
  await page.getByLabel("Meal name", { exact: true }).fill("Late-night snack");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Remove this meal", exact: true })
    .click();
  await expect(page.getByLabel("Meal name", { exact: true })).toHaveValue(
    "Dinner",
  );
  await page
    .getByRole("button", { name: "Add another meal", exact: true })
    .click();
  await page.getByLabel("Meal name", { exact: true }).fill("Late-night snack");
  await page
    .getByRole("button", { name: "Can’t find your food? Add a custom food" })
    .click();
  await page
    .getByLabel("Food name", { exact: true })
    .fill("Synthetic sixth-meal food");
  await page.getByLabel("Quantity unit", { exact: true }).fill("bowl");
  await page.getByRole("button", { name: "Add Food", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your Typical Day" }),
  ).toBeVisible();
  await page
    .getByLabel("How representative is this day?")
    .selectOption("Very typical");
  await page
    .getByRole("combobox", { name: "Day type", exact: true })
    .selectOption("Typical weekday");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Late-night snack", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("everyday-diet-study:draft:v2")!).draft,
  );
  expect(saved.mealOrder).toHaveLength(6);
  expect(saved.meals[saved.mealOrder[5]].label).toBe("Late-night snack");
  await page
    .getByLabel(
      "I confirm that these answers describe my usual eating habits as accurately as I can remember.",
    )
    .check();
  await page.getByRole("button", { name: "Submit Response" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for taking part." }),
  ).toBeVisible();
});

test("touch search, long custom text, unsaved edit warning, review and narrow layouts", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await breakfast(page);
  const search = page.getByRole("combobox", { name: "Search for a food" });
  await search.fill("chai");
  await fits(page, "search");
  const tea = page
    .getByRole("option")
    .filter({ hasText: "Hot tea (Garam Chai)" });
  if (isMobile) await tea.tap();
  else await tea.click();
  await expect(
    page.getByRole("region", { name: "Food details" }),
  ).toBeVisible();
  await fits(page, "quantity");
  if (isMobile)
    expect(
      await page
        .getByRole("spinbutton")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
  await page.getByRole("button", { name: "Add Food", exact: true }).click();
  await page.getByRole("button", { name: "Edit Hot tea (Garam Chai)" }).click();
  await page.getByRole("spinbutton").fill("2.5");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Breakfast", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("spinbutton")).toHaveValue("2.5");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: "Can’t find your food? Add a custom food" })
    .click();
  await page
    .getByLabel("Food name", { exact: true })
    .fill("VeryLongHomemadeFood".repeat(10));
  await page
    .getByLabel("Quantity unit", { exact: true })
    .fill("LargeHouseholdServingUnit".repeat(3));
  await page
    .getByLabel("Preparation (optional)")
    .fill("Test preparation ".repeat(15));
  await fits(page, "custom-food");
  await page.getByRole("button", { name: "Add Food", exact: true }).click();
  await fits(page, "meal-list");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("I usually skip this meal").check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await page
    .getByLabel("How representative is this day?")
    .selectOption("Very typical");
  await page
    .getByRole("combobox", { name: "Day type", exact: true })
    .selectOption("Typical weekday");
  await fits(page, "typical-day");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fits(page, "long-review");
  expect(errors).toEqual([]);
});

test("profile errors are visible and focused", async ({ page }) => {
  await begin(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toBeFocused();
  await expect(alert).toBeInViewport();
  await fits(page, "validation");
});

test("blocked browser storage does not crash the questionnaire", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  await begin(page);
  await expect(
    page.getByRole("heading", { name: "Personal Profile" }),
  ).toBeVisible();
  await expect(
    page.getByText("This browser cannot save your draft.", { exact: false }),
  ).toBeVisible();
});

test("catalog connection failure can be retried", async ({ page }) => {
  await page.route("**/data/indb_food_catalog.json", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Retry loading study" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Begin questionnaire" }),
  ).toBeDisabled();
  await page.unroute("**/data/indb_food_catalog.json");
  await page.getByRole("button", { name: "Retry loading study" }).click();
  await expect(page.getByText("Synthetic test institution")).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByRole("button", { name: "Begin questionnaire" }),
  ).toBeEnabled();
});
