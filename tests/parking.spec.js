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

test('1. page loads with correct title', async ({ page }) => {
  await page.goto('/parking.html');
  await expect(page).toHaveTitle(/Parking/);
});

test('2. empty submit shows all 9 field errors', async ({ page }) => {
  await page.goto('/parking.html');
  await page.click('#submit-btn');
  // 9 required fields: p-first, p-last, p-email, p-phone, p-dl, p-ins, p-reg, p-start, p-end
  await expect(page.locator('#fg-first')).toHaveClass(/has-err/);
  await expect(page.locator('#fg-last')).toHaveClass(/has-err/);
  await expect(page.locator('#fg-email')).toHaveClass(/has-err/);
  await expect(page.locator('#fg-phone')).toHaveClass(/has-err/);
  await expect(page.locator('#fg-dl')).toHaveClass(/has-err/);
  await expect(page.locator('#fg-ins')).toHaveClass(/has-err/);
  await expect(page.locator('#fg-reg')).toHaveClass(/has-err/);
  await expect(page.locator('#fg-start')).toHaveClass(/has-err/);
  await expect(page.locator('#fg-end')).toHaveClass(/has-err/);
});

test('3. valid email clears error after re-submit', async ({ page }) => {
  await page.goto('/parking.html');
  // First trigger validation errors
  await page.click('#submit-btn');
  await expect(page.locator('#fg-email')).toHaveClass(/has-err/);
  // Fill valid email and re-submit
  await page.fill('#p-email', 'jane@example.com');
  await page.click('#submit-btn');
  await expect(page.locator('#fg-email')).not.toHaveClass(/has-err/);
});

test('4. date: end < 6 months shows error', async ({ page }) => {
  await page.goto('/parking.html');
  await page.fill('#p-start', '2026-07-01');
  await page.fill('#p-end', '2026-10-01');
  // validateDates checks if end is at least 6 months after start
  const result = await page.evaluate(() => validateDates());
  expect(result).toBe(false);
  await expect(page.locator('#date-err')).toBeVisible();
});

test('5. date: exactly 6 months passes', async ({ page }) => {
  await page.goto('/parking.html');
  await page.fill('#p-start', '2026-07-01');
  await page.fill('#p-end', '2027-01-01');
  const result = await page.evaluate(() => validateDates());
  expect(result).toBe(true);
  await expect(page.locator('#date-err')).toBeHidden();
});

test('6. per-file size limit: file over 5MB shows error', async ({ page }) => {
  await page.goto('/parking.html');
  // Inject a 6MB fake File into p-dl via DataTransfer
  await page.evaluate(() => {
    const dt = new DataTransfer();
    const bigContent = new Uint8Array(6 * 1024 * 1024); // 6MB
    const file = new File([bigContent], 'large.jpg', { type: 'image/jpeg' });
    dt.items.add(file);
    const input = document.getElementById('p-dl');
    Object.defineProperty(input, 'files', { value: dt.files, writable: false, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Call reqFile to validate
  const result = await page.evaluate(() => reqFile('p-dl'));
  expect(result).toBe(false);
  await expect(page.locator('#fg-dl')).toHaveClass(/has-err/);
  const errMsg = await page.locator('#fg-dl .field-err-msg').textContent();
  expect(errMsg).toMatch(/too large/i);
});

test('7. total size > 7MB shows alert', async ({ page }) => {
  await page.goto('/parking.html');

  // Fill all required text fields to pass basic validation
  await page.fill('#p-first', 'Jane');
  await page.fill('#p-last', 'Smith');
  await page.fill('#p-email', 'jane@example.com');
  await page.fill('#p-phone', '5105550100');
  await page.fill('#p-start', '2026-07-01');
  await page.fill('#p-end', '2027-01-01');

  // Inject files totaling >7MB using getter-based defineProperty
  await page.evaluate(() => {
    function makeFakeFile(id, sizeMB) {
      const content = new Uint8Array(sizeMB * 1024 * 1024);
      const file = new File([content], `file_${id}.jpg`, { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById(id);
      Object.defineProperty(input, 'files', {
        get: () => dt.files,
        configurable: true,
      });
    }
    makeFakeFile('p-dl', 3);
    makeFakeFile('p-ins', 3);
    makeFakeFile('p-reg', 2);
  });

  // Set up alert interceptor before triggering submit
  const dialogPromise = page.waitForEvent('dialog');
  // Fire submit without awaiting — the dialog blocks JS, so page.evaluate would hang if awaited
  page.evaluate(() => {
    document.getElementById('parking-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }).catch(() => {}); // ignore — dialog blocks resolution

  const dialog = await dialogPromise;
  expect(dialog.message()).toMatch(/MB/i);
  await dialog.dismiss();
});

test('8. file under limit passes', async ({ page }) => {
  await page.goto('/parking.html');
  // Inject 1MB file into p-dl
  await page.evaluate(() => {
    const dt = new DataTransfer();
    const content = new Uint8Array(1 * 1024 * 1024); // 1MB
    const file = new File([content], 'small.jpg', { type: 'image/jpeg' });
    dt.items.add(file);
    const input = document.getElementById('p-dl');
    Object.defineProperty(input, 'files', { value: dt.files, writable: false, configurable: true });
  });
  const result = await page.evaluate(() => reqFile('p-dl'));
  expect(result).toBe(true);
  await expect(page.locator('#fg-dl')).not.toHaveClass(/has-err/);
});

test('9. success page exists with "Application submitted" heading', async ({ page }) => {
  await page.goto('/parking-success.html');
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();
  await expect(heading).toContainText('Application submitted');
});
