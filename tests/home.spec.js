// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ context }) => {
  await context.addCookies([{
    name: 'traffic_type',
    value: 'developer',
    domain: 'localhost',
    path: '/',
  }]);
});

test('page title contains "Tran Properties"', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Tran Properties/);
});

test('hero h1 is visible', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
});

test('Parker St listing shows price "$3,295"', async ({ page }) => {
  await page.goto('/');
  const price = page.locator('.listing-price').first();
  await expect(price).toContainText('$3,295');
});

test('listing address is a link with href containing google.com/maps', async ({ page }) => {
  await page.goto('/');
  const addrLink = page.locator('.listing-addr a').first();
  await expect(addrLink).toBeVisible();
  const href = await addrLink.getAttribute('href');
  expect(href).toContain('google.com/maps');
});

test('"Open in Google Maps" text does NOT appear', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Open in Google Maps')).toHaveCount(0);
});

test('nav has "Apply now" button', async ({ page }) => {
  await page.goto('/');
  const applyBtn = page.locator('nav').getByText('Apply now');
  await expect(applyBtn).toBeVisible();
});

test('footer has "Parking application" link pointing to /parking.html', async ({ page }) => {
  await page.goto('/');
  const parkingLink = page.locator('footer').getByRole('link', { name: 'Parking application' });
  await expect(parkingLink).toBeVisible();
  const href = await parkingLink.getAttribute('href');
  expect(href).toContain('parking.html');
});

test('footer has "Apply — Parker St" link', async ({ page }) => {
  await page.goto('/');
  const applyLink = page.locator('footer').getByRole('link', { name: /Apply — Parker St/i });
  await expect(applyLink).toBeVisible();
});

test('"View available units" button is visible', async ({ page }) => {
  await page.goto('/');
  const btn = page.getByRole('link', { name: 'View available units' });
  await expect(btn).toBeVisible();
});
