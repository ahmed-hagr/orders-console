import { expect, test, type Page, type Route } from "@playwright/test";

const LIST_REQUEST = /\/api\/orders\?/;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@sarh.test");
  await page.getByLabel("Password").fill("Admin#2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/orders");
  await expect(page.locator(".ant-table-tbody-virtual .ant-tag").first()).toBeVisible();
}

const statusOf = (url: string) => new URL(url).searchParams.get("status") ?? "all";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("R1: an earlier, slower response never overwrites the latest filter", async ({ page }) => {
  await signIn(page);

  // Hold each list response longer the earlier its filter is clicked, so the stale ones arrive last.
  const delayMs: Record<string, number> = { pending: 2000, shipped: 1000, cancelled: 0 };
  const delivered: string[] = [];
  const held: Promise<void>[] = [];

  await page.route(LIST_REQUEST, (route: Route) => {
    const status = statusOf(route.request().url());
    const done = (async () => {
      const response = await route.fetch();
      await sleep(delayMs[status] ?? 0);
      // fulfill() still succeeds after the app aborts the request; the browser just discards it.
      await route.fulfill({ response }).catch(() => {});
      delivered.push(status);
    })();
    held.push(done);
    return done;
  });

  const aborted: string[] = [];
  page.on("requestfailed", (req) => {
    if (LIST_REQUEST.test(req.url())) aborted.push(statusOf(req.url()));
  });

  // The brief's hand test: change the filter three times in quick succession.
  const filters = page.getByLabel("Status filter");
  for (const name of ["Pending", "Shipped", "Cancelled"]) {
    await filters.getByText(name, { exact: true }).click();
    await sleep(100);
  }

  // Wait until every held response has been delivered, slowest (Pending) last.
  await expect.poll(() => held.length).toBe(3);
  await Promise.all(held);
  expect(delivered).toEqual(["cancelled", "shipped", "pending"]);
  console.log(`clicked Pending -> Shipped -> Cancelled; responses delivered: ${delivered.join(" -> ")}`);

  // The screen still shows the latest filter, and only its rows.
  await expect(page).toHaveURL(/status=cancelled/);
  await expect(page.locator(".ant-segmented-item-selected")).toHaveText("Cancelled");
  const statuses = await page.locator(".ant-table-tbody-virtual .ant-tag").allTextContents();
  expect(statuses.length).toBeGreaterThan(0);
  expect(new Set(statuses)).toEqual(new Set(["Cancelled"]));

  // Bonus: the superseded requests were cancelled by the app, not just ignored.
  expect(aborted).toEqual(expect.arrayContaining(["pending", "shipped"]));
});
