import { expect, test } from "@playwright/test";
import { createServer } from "vite";

let viteServer;

test.beforeAll(async () => {
  viteServer = await createServer({
    configLoader: "runner",
    server: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
    },
  });
  await viteServer.listen();
});

test.afterAll(async () => {
  await viteServer?.close();
});

test("backend login connects the login page to the authenticated home page", async ({ page }) => {
  await page.route("**/AirNote_Backend/api/users/login", async (route) => {
    const requestBody = route.request().postDataJSON();
    expect(requestBody).toEqual({
      email: "presenter@airnote.test",
      password: "integration-pass",
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "login success",
        data: {
          userId: 42,
          name: "통합테스트",
          email: "presenter@airnote.test",
        },
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AirNote", exact: true })).toBeVisible();

  await page.locator("#loginEmail").fill("presenter@airnote.test");
  await page.locator("#loginPassword").fill("integration-pass");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page).toHaveURL(/\/pages\/home\.html$/);
  await expect(page.locator("#homeGreeting")).toContainText("통합테스트");

  const loginState = await page.evaluate(() => ({
    userId: localStorage.getItem("airnoteCurrentUserId"),
    email: localStorage.getItem("airnoteCurrentUserEmail"),
    sessionActive: sessionStorage.getItem("airnoteSessionActive"),
  }));

  expect(loginState).toEqual({
    userId: "42",
    email: "presenter@airnote.test",
    sessionActive: "true",
  });
});

test("protected pages redirect anonymous users to login", async ({ page }) => {
  await page.goto("/pages/home.html");

  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
});
