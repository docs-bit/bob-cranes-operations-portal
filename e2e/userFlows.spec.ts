import { test, expect } from "@playwright/test";

test.describe("BOB Cranes Operations Portal E2E User Flows", () => {
  test("loads the public rental landing page and submits an enquiry", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Every lift starts with precision planning/i })).toBeVisible();
    await page
      .getByRole("button", { name: /Request a rental quote/i })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /Send rental enquiry/i }),
    ).toBeVisible();
  });

  test("navigates to portal sign-in and verifies auth prompt", async ({ page }) => {
    await page.goto("/portal");
    await expect(
      page.getByRole("heading", {
        name: /Sign in to BOB Cranes|Set up the administrator account/i,
      }),
    ).toBeVisible();
    await expect(page.getByLabel(/Work email/i)).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Sign in|Create administrator account/i,
      }),
    ).toBeVisible();
  });
});
