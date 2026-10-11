import { expect, test } from "@playwright/test";
test("complete survey, search, edit, custom food, skips, refresh, receipt and safe retry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Synthetic test institution")).toBeVisible({
    timeout: 15000,
  });
  await page.screenshot({
    path: `test-results/welcome-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("Your age in completed years").fill("71");
  await page.getByLabel("I have read the participant information.").check();
  await page.getByLabel("I voluntarily consent to participate.").check();
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await page.getByLabel("Male", { exact: true }).check();
  await expect(
    page
      .getByRole("group", { name: "Sex (for nutritional estimation)" })
      .getByRole("radio"),
  ).toHaveCount(2);
  await page.getByLabel("Height (cm)").fill("170");
  await page.getByLabel("Weight (kg)").fill("65");
  await page
    .getByLabel("Primary dietary goal")
    .selectOption("Weight maintenance");
  await page
    .getByRole("combobox", { name: "Dietary preference", exact: true })
    .selectOption("Vegetarian");
  await page.getByLabel("None", { exact: true }).check();
  await page.reload();
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await expect(page.getByLabel("Height (cm)")).toHaveValue("170");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Search for a food" })
    .fill("garam chai");
  await page
    .getByRole("combobox", { name: "Search for a food" })
    .press("ArrowDown");
  await page
    .getByRole("combobox", { name: "Search for a food" })
    .press("Enter");
  await page
    .getByRole("spinbutton", { name: "Quantity in tea cup" })
    .fill("1.25");
  await page.getByRole("button", { name: "Add Food", exact: true }).click();
  await page.getByRole("button", { name: "Edit Hot tea (Garam Chai)" }).click();
  await page
    .getByRole("spinbutton", { name: "Quantity in tea cup" })
    .fill("0.75");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Can’t find your food? Add a custom food" })
    .click();
  await page.getByLabel("Food name", { exact: true }).fill("Family recipe");
  await page.getByLabel("Quantity unit", { exact: true }).fill("bowl");
  await page.getByRole("button", { name: "Add Food", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("I usually skip this meal").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("I usually skip this meal").check();
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
  await expect(page.getByText("0.75 × tea cup")).toBeVisible();
  await page.getByRole("button", { name: "Edit breakfast" }).click();
  await expect(
    page.getByText("Hot tea (Garam Chai)", { exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel(
      "I confirm that these answers describe my usual eating habits as accurately as I can remember.",
    )
    .check();
  await page.screenshot({
    path: `test-results/review-${test.info().project.name}.png`,
    fullPage: true,
  });
  const savedDraft = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("everyday-diet-study:draft:v2")!).draft,
  );
  await page.getByRole("button", { name: "Submit Response" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for taking part." }),
  ).toBeVisible();
  const firstReceipt = await page.locator(".receipt code").textContent();
  const retriedReceipt = await page.evaluate(async (draft) => {
    const modulePath = "/src/firebase.ts";
    const service = await import(/* @vite-ignore */ modulePath);
    const catalog = await fetch("/data/indb_food_catalog.json").then((r) =>
      r.json(),
    );
    return service.submitResponse(draft, catalog);
  }, savedDraft);
  expect(retriedReceipt).toBe(firstReceipt);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("everyday-diet-study:draft:v2")),
    )
    .toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Thank you for taking part." }),
  ).toBeVisible();
  await expect(page.locator(".receipt code")).toHaveText(firstReceipt!);
});
test("16–17 blocked pending approvals; fractional and underage ages rejected", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Synthetic test institution")).toBeVisible({
    timeout: 15000,
  });
  for (const age of ["15", "16.5"]) {
    await page.getByLabel("Your age in completed years").fill(age);
    await expect(
      page.getByText("Enter a whole-number age of 16 or above."),
    ).toBeVisible();
  }
  await page.getByLabel("Your age in completed years").fill("16");
  await expect(
    page.getByText("Participation for ages 16–17 is not open.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome & Consent" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("everyday-diet-study:draft:v2"),
    ),
  ).toBeNull();
});
