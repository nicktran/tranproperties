// @ts-check
const { test, expect } = require('@playwright/test');

async function gotoApply(page) {
  await page.goto('/#apply');
  await page.waitForSelector('#fs-1.active');
}

// Helper: advance from step 1 to step 2 using the new app type cards
async function advanceToStep2(page, type = 'tenant') {
  await page.evaluate((t) => selectAppType(t), type);
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
}

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{
    name: 'traffic_type',
    value: 'developer',
    domain: 'localhost',
    path: '/',
  }]);
  await page.addInitScript(() => { sessionStorage.clear(); });
});

test('1. clicking Tenant card advances to step 2', async ({ page }) => {
  await gotoApply(page);
  await page.click('#atc-tenant');
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
});

test('2. back button returns to step 1', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page);
  await page.click('#fs-2 .form-nav .btn-ghost');
  await expect(page.locator('#fs-1')).toHaveClass(/active/);
});

test('3. empty step 2 submit shows errors on required fields', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page);
  await page.click('#fs-2 .form-nav-right .btn-accent');
  const fieldAncestor = (id) =>
    page.locator(`#${id}`).locator('xpath=ancestor::div[contains(@class,"field")][1]');
  await expect(fieldAncestor('f-first')).toHaveClass(/has-err/);
  await expect(fieldAncestor('f-last')).toHaveClass(/has-err/);
  await expect(fieldAncestor('f-email')).toHaveClass(/has-err/);
  await expect(fieldAncestor('f-phone')).toHaveClass(/has-err/);
  await expect(fieldAncestor('f-dob')).toHaveClass(/has-err/);
  await expect(page.locator('#idtype-err')).toBeVisible();
});

test('4. invalid email shows error', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page);
  await page.fill('#f-first', 'Jane');
  await page.fill('#f-last', 'Smith');
  await page.fill('#f-email', 'notanemail');
  await page.fill('#f-phone', '5105551234');
  await page.fill('#f-dob', '1990-01-01');
  await page.click('#fs-2 .form-nav-right .btn-accent');
  const emailField = page.locator('#f-email').locator('xpath=ancestor::div[contains(@class,"field")][1]');
  await expect(emailField).toHaveClass(/has-err/);
});

test('5. tenant app type — step 4 indicator not dimmed', async ({ page }) => {
  await gotoApply(page);
  await page.evaluate(() => pickAppType('tenant'));
  const opacity = await page.locator('#si-4').evaluate(el => el.style.opacity);
  expect(opacity).not.toBe('0.3');
});

test('6. co-signer hides step 4 (skips from 3 to 5)', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page, 'cosigner');

  await page.fill('#f-first', 'John');
  await page.fill('#f-last', 'Doe');
  await page.fill('#f-email', 'john@example.com');
  await page.fill('#f-phone', '5105550000');
  await page.fill('#f-dob', '1985-05-15');
  await page.evaluate(() => {
    const r = document.querySelector('input[name="occ"][value="1"]');
    r.checked = true; r.closest('.rc-label').classList.add('on'); updateRoommates(1);
  });
  const tenantField = page.locator('#f-roommate-1');
  if (await tenantField.isVisible()) await tenantField.fill('Alice Tenant');
  await page.evaluate(() => {
    const r = document.querySelector('input[name="id-type"][value="SSN"]');
    r.checked = true; r.closest('.rc-label').classList.add('on'); toggleIdFields('SSN');
  });
  await page.fill('#f-ssn', '123-45-6789');
  await page.fill('#f-ssn2', '123-45-6789');
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['dummy'], 'id.jpg', { type: 'image/jpeg' }));
    const input = document.getElementById('f-photoid');
    Object.defineProperty(input, 'files', { value: dt.files });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('#fs-2 .form-nav-right .btn-accent');
  await expect(page.locator('#fs-3')).toHaveClass(/active/);

  await page.evaluate(() => {
    const r = document.querySelector('input[name="emp"][value="Employed"]');
    r.checked = true; r.closest('.rc-label').classList.add('on');
  });
  await page.fill('#f-income', '8000');
  await page.fill('#f-savings', '20000');
  await page.click('#fs-3 .form-nav-right .btn-accent');
  await expect(page.locator('#fs-5')).toHaveClass(/active/);
  await expect(page.locator('#fs-4')).not.toHaveClass(/active/);
});

test('7. occupant 2 generates roommate field', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page);
  await page.evaluate(() => {
    const r = document.querySelector('input[name="occ"][value="2"]');
    r.checked = true; r.closest('.rc-label').classList.add('on'); updateRoommates(2);
  });
  await expect(page.locator('#f-roommate-2')).toBeVisible();
});

test('8. vehicle card pre-renders on load', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page);
  await expect(page.locator('#vehicle-1')).toBeVisible();
});

test('9. add another vehicle creates vehicle-2', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page);
  await page.click('button:has-text("+ Add another vehicle")');
  await expect(page.locator('#vehicle-2')).toBeVisible();
});

test('10. remove vehicle 2 — vehicle-2 disappears', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page);
  await page.click('button:has-text("+ Add another vehicle")');
  await expect(page.locator('#vehicle-2')).toBeVisible();
  await page.click('#vehicle-2 button:has-text("✕ Remove")');
  await expect(page.locator('#vehicle-2')).toHaveCount(0);
});

test('11. session state preserved on reload', async ({ page }) => {
  await page.goto('/#apply');
  await page.waitForSelector('#fs-1.active');
  await advanceToStep2(page);
  await page.fill('#f-first', 'Jane');
  await page.fill('#f-last', 'Smith');
  await page.fill('#f-email', 'jane@test.com');
  await page.evaluate(() => saveState());

  const savedState = await page.evaluate(() => sessionStorage.getItem('tp-app-state'));
  expect(savedState).not.toBeNull();
  await page.addInitScript((state) => { sessionStorage.setItem('tp-app-state', state); }, savedState);

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  // Wait for restoreState to populate the field (it has a 50ms setTimeout for setStep)
  await page.waitForFunction(() => document.getElementById('f-first').value === 'Jane', { timeout: 5000 });

  expect(await page.inputValue('#f-first')).toBe('Jane');
  expect(await page.inputValue('#f-last')).toBe('Smith');
  expect(await page.inputValue('#f-email')).toBe('jane@test.com');
});

test('12. session state cleared on restart', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page);
  await page.fill('#f-first', 'Jane');
  await page.waitForTimeout(500);
  await page.evaluate(() => restartApplication());
  await expect(page.locator('#fs-1')).toHaveClass(/active/);
  await advanceToStep2(page);
  expect(await page.inputValue('#f-first')).toBe('');
});

test('13. SSN formatting adds dashes', async ({ page }) => {
  await gotoApply(page);
  await advanceToStep2(page);
  await page.evaluate(() => toggleIdFields('SSN'));
  await expect(page.locator('#ssn-field')).toBeVisible();
  await page.locator('#f-ssn').click();
  await page.keyboard.type('123456789');
  const value = await page.evaluate(() => document.getElementById('f-ssn').value);
  expect(value).toMatch(/\d{3}-\d{2}-\d{4}/);
});

test('14. step progress indicator updates with done/active classes', async ({ page }) => {
  await gotoApply(page);
  await expect(page.locator('#si-1')).toHaveClass(/active/);
  await expect(page.locator('#si-2')).not.toHaveClass(/active/);
  await advanceToStep2(page);
  await expect(page.locator('#si-1')).toHaveClass(/done/);
  await expect(page.locator('#si-2')).toHaveClass(/active/);
});
