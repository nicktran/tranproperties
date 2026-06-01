// @ts-check
const { test, expect } = require('@playwright/test');

async function gotoApply(page) {
  await page.goto('/#apply');
  // Wait for the form to be ready
  await page.waitForSelector('#fs-1.active');
}

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{
    name: 'traffic_type',
    value: 'developer',
    domain: 'localhost',
    path: '/',
  }]);
  // Clear session storage to start fresh
  await page.addInitScript(() => {
    sessionStorage.clear();
  });
});

test('1. clicking unit card advances to step 2', async ({ page }) => {
  await gotoApply(page);
  // First pick app type to make step 1 valid
  await page.evaluate(() => pickAppType('tenant'));
  await page.click('#pc-parker');
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
});

test('2. back button returns to step 1', async ({ page }) => {
  await gotoApply(page);
  // Advance to step 2 via JS
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
  await page.click('#fs-2 .form-nav .btn-ghost');
  await expect(page.locator('#fs-1')).toHaveClass(/active/);
});

test('3. empty step 2 submit shows errors on required fields', async ({ page }) => {
  await gotoApply(page);
  // Go to step 2
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
  // Click continue without filling anything
  await page.click('#fs-2 .form-nav-right .btn-accent');
  // Required fields should now show errors — use xpath to find the .field ancestor
  const fieldAncestor = (id) =>
    page.locator(`#${id}`).locator('xpath=ancestor::div[contains(@class,"field")][1]');
  await expect(fieldAncestor('f-first')).toHaveClass(/has-err/);
  await expect(fieldAncestor('f-last')).toHaveClass(/has-err/);
  await expect(fieldAncestor('f-email')).toHaveClass(/has-err/);
  await expect(fieldAncestor('f-phone')).toHaveClass(/has-err/);
  await expect(fieldAncestor('f-dob')).toHaveClass(/has-err/);
  // id-type error shown
  await expect(page.locator('#idtype-err')).toBeVisible();
});

test('4. invalid email shows error', async ({ page }) => {
  await gotoApply(page);
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
  // Fill required fields but bad email
  await page.fill('#f-first', 'Jane');
  await page.fill('#f-last', 'Smith');
  await page.fill('#f-email', 'notanemail');
  await page.fill('#f-phone', '5105551234');
  await page.fill('#f-dob', '1990-01-01');
  // Click continue to trigger validation
  await page.click('#fs-2 .form-nav-right .btn-accent');
  // Email field's .field ancestor should have has-err
  const emailField = page.locator('#f-email').locator('xpath=ancestor::div[contains(@class,"field")][1]');
  await expect(emailField).toHaveClass(/has-err/);
});

test('5. tenant app type — step 4 indicator not dimmed', async ({ page }) => {
  await gotoApply(page);
  await page.evaluate(() => pickAppType('tenant'));
  const si4 = page.locator('#si-4');
  // opacity should be '' (not 0.3)
  const opacity = await si4.evaluate(el => el.style.opacity);
  expect(opacity).not.toBe('0.3');
});

test('6. co-signer hides step 4 (skips from 3 to 5)', async ({ page }) => {
  await gotoApply(page);
  // Select co-signer app type
  await page.evaluate(() => pickAppType('cosigner'));
  // Advance to step 2
  await page.evaluate(() => selectUnit('parker'));
  await expect(page.locator('#fs-2')).toHaveClass(/active/);

  // Fill step 2 required fields
  await page.fill('#f-first', 'John');
  await page.fill('#f-last', 'Doe');
  await page.fill('#f-email', 'john@example.com');
  await page.fill('#f-phone', '5105550000');
  await page.fill('#f-dob', '1985-05-15');
  // Select 1 occupant (for cosigner, count of tenants)
  await page.evaluate(() => {
    const r = document.querySelector('input[name="occ"][value="1"]');
    r.checked = true;
    r.closest('.rc-label').classList.add('on');
    updateRoommates(1);
  });
  // Fill tenant name field that appears for cosigner
  const tenantField = page.locator('#f-roommate-1');
  if (await tenantField.isVisible()) {
    await tenantField.fill('Alice Tenant');
  }
  // Select ID type SSN
  await page.evaluate(() => {
    const r = document.querySelector('input[name="id-type"][value="SSN"]');
    r.checked = true;
    r.closest('.rc-label').classList.add('on');
    toggleIdFields('SSN');
  });
  await page.fill('#f-ssn', '123-45-6789');
  await page.fill('#f-ssn2', '123-45-6789');
  // Upload photo ID (use a dummy file via JS)
  await page.evaluate(() => {
    const dt = new DataTransfer();
    const file = new File(['dummy'], 'id.jpg', { type: 'image/jpeg' });
    dt.items.add(file);
    const input = document.getElementById('f-photoid');
    Object.defineProperty(input, 'files', { value: dt.files });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await page.click('#fs-2 .form-nav-right .btn-accent');
  await expect(page.locator('#fs-3')).toHaveClass(/active/);

  // Fill step 3 required fields
  await page.evaluate(() => {
    const r = document.querySelector('input[name="emp"][value="Employed"]');
    r.checked = true;
    r.closest('.rc-label').classList.add('on');
  });
  await page.fill('#f-income', '8000');
  await page.fill('#f-savings', '20000');

  // Click continue on step 3 — should skip to step 5 for co-signer
  await page.click('#fs-3 .form-nav-right .btn-accent');
  await expect(page.locator('#fs-5')).toHaveClass(/active/);
  await expect(page.locator('#fs-4')).not.toHaveClass(/active/);
});

test('7. occupant 2 generates roommate field', async ({ page }) => {
  await gotoApply(page);
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
  // Select 2 occupants
  await page.evaluate(() => {
    const r = document.querySelector('input[name="occ"][value="2"]');
    r.checked = true;
    r.closest('.rc-label').classList.add('on');
    updateRoommates(2);
  });
  await expect(page.locator('#f-roommate-2')).toBeVisible();
});

test('8. vehicle card pre-renders on load', async ({ page }) => {
  await gotoApply(page);
  // #vehicle-1 is inside #fs-2 which is hidden on load, but the element exists in the DOM
  // Navigate to step 2 to confirm it's visible there
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
  await expect(page.locator('#vehicle-1')).toBeVisible();
});

test('9. add another vehicle creates vehicle-2', async ({ page }) => {
  await gotoApply(page);
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
  await page.click('button:has-text("+ Add another vehicle")');
  await expect(page.locator('#vehicle-2')).toBeVisible();
});

test('10. remove vehicle 2 — vehicle-2 disappears', async ({ page }) => {
  await gotoApply(page);
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
  await page.click('button:has-text("+ Add another vehicle")');
  await expect(page.locator('#vehicle-2')).toBeVisible();
  // Click the remove button inside vehicle-2
  await page.click('#vehicle-2 button:has-text("✕ Remove")');
  await expect(page.locator('#vehicle-2')).toHaveCount(0);
});

test('11. session state preserved on reload', async ({ page }) => {
  await page.goto('/#apply');
  await page.waitForSelector('#fs-1.active');

  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
  await page.fill('#f-first', 'Jane');
  await page.fill('#f-last', 'Smith');
  await page.fill('#f-email', 'jane@test.com');

  // Force save state immediately (bypass 300ms debounce)
  await page.evaluate(() => saveState());

  // Inject the saved state directly into sessionStorage so addInitScript clear doesn't wipe it on reload.
  // We accomplish this by adding a new initScript that restores it before page scripts run.
  const savedState = await page.evaluate(() => sessionStorage.getItem('tp-app-state'));
  expect(savedState).not.toBeNull();

  // Add a one-time initScript that re-injects state before page scripts run
  await page.addInitScript((state) => {
    sessionStorage.setItem('tp-app-state', state);
  }, savedState);

  // Reload — addInitScript (clear) runs first, then our new initScript re-injects
  await page.reload();
  await page.waitForSelector('#fs-1, #fs-2');
  // Wait for state restoration (setTimeout 50ms for step navigation)
  await page.waitForTimeout(300);

  // Values should be restored
  const firstName = await page.inputValue('#f-first');
  expect(firstName).toBe('Jane');
  const lastName = await page.inputValue('#f-last');
  expect(lastName).toBe('Smith');
  const email = await page.inputValue('#f-email');
  expect(email).toBe('jane@test.com');
});

test('12. session state cleared on restart', async ({ page }) => {
  await gotoApply(page);
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await page.fill('#f-first', 'Jane');
  await page.waitForTimeout(500);
  // Call restartApplication
  await page.evaluate(() => restartApplication());
  await expect(page.locator('#fs-1')).toHaveClass(/active/);
  // Navigate to step 2 to check fields are cleared
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  const firstName = await page.inputValue('#f-first');
  expect(firstName).toBe('');
});

test('13. SSN formatting adds dashes', async ({ page }) => {
  await gotoApply(page);
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  await expect(page.locator('#fs-2')).toHaveClass(/active/);
  // Show SSN field
  await page.evaluate(() => toggleIdFields('SSN'));
  await expect(page.locator('#ssn-field')).toBeVisible();

  // Type digits into SSN field
  const ssnInput = page.locator('#f-ssn');
  // The field briefly becomes type=text after typing
  await ssnInput.click();
  await page.keyboard.type('123456789');

  // After typing, it briefly becomes text — grab value while it might still be text
  // or check the formatted value via evaluate
  const value = await page.evaluate(() => document.getElementById('f-ssn').value);
  expect(value).toMatch(/\d{3}-\d{2}-\d{4}/);
});

test('14. step progress indicator updates with done/active classes', async ({ page }) => {
  await gotoApply(page);
  // Initially step 1 is active
  await expect(page.locator('#si-1')).toHaveClass(/active/);
  await expect(page.locator('#si-2')).not.toHaveClass(/active/);

  // Advance to step 2
  await page.evaluate(() => {
    pickAppType('tenant');
    selectUnit('parker');
  });
  // si-1 should be done, si-2 active
  await expect(page.locator('#si-1')).toHaveClass(/done/);
  await expect(page.locator('#si-2')).toHaveClass(/active/);
});
