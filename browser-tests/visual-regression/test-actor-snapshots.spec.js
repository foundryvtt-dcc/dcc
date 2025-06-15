const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('DCC System V2 Migration Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Go to join page
    await page.goto('http://localhost:30000/join');

    // Select Gamemaster from userid dropdown
    await page.selectOption('select[name="userid"]', 'Gamemaster');

    // Click join button
    await page.click('button[name="join"]');

    // Wait for game to load
    await page.waitForSelector('.game.system-dcc', { timeout: 5000 });

    // Wait for Foundry to fully initialize (actors sidebar, etc.)
    await page.waitForSelector('#actors', { timeout: 30000, state: 'attached' });

    // Click the actors tab to make it visible
    await page.click('a[data-tab="actors"]');
    await page.waitForSelector('#actors.active', { timeout: 5000 });

    // Open the actor folders to make actors accessible
    await page.click('[data-folder-id] .folder-header h3:has-text("pc-upper")');
    await page.click('[data-folder-id] .folder-header h3:has-text("pc-zero")');
    await page.waitForTimeout(1000); // Wait for folders to expand
  });

  test('DCC Welcome Dialog', async ({ page }) => {
    // Take screenshot of welcome dialog if it exists
    const welcomeDialog = page.locator('#dcc-welcome-dialog');
    if (await welcomeDialog.isVisible()) {
      await expect(welcomeDialog).toHaveScreenshot('dcc-welcome-dialog.png');
    }
  });

  test('DCC Core Book Welcome Dialog', async ({ page }) => {
    // Take screenshot of core book welcome dialog if it exists
    const welcomeDialog = page.locator('#dcc-core-book-welcome-dialog');
    if (await welcomeDialog.isVisible()) {
      await expect(welcomeDialog).toHaveScreenshot('dcc-core-book-welcome-dialog.png');
    }
  });

  // Get all actor data files
  const dataDir = path.join(__dirname, 'baseline', 'data');
  const dataFiles = fs.readdirSync(dataDir).filter(file =>
    file.startsWith('fvtt-Actor-') && file.endsWith('.json')
  );

  // Extract actor ID from filename (last part before .json)
  const actors = dataFiles.map(file => {
    const match = file.match(/fvtt-Actor-.*-([a-zA-Z0-9]+)\.json$/);
    return {
      id: match ? match[1] : null,
      name: file.replace('fvtt-Actor-', '').replace(/\.json$/, '').replace(/-[a-zA-Z0-9]+$/, ''),
      filename: file
    };
  }).filter(actor => actor.id);

  actors.forEach(actor => {
    test(`Actor sheet snapshots for ${actor.name}`, async ({ page }) => {
      // Close any welcome dialogs that might be open
      const dccDialog = page.locator('#dcc-welcome-dialog');
      if (await dccDialog.isVisible()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      const coreBookDialog = page.locator('#dcc-core-book-welcome-dialog');
      if (await coreBookDialog.isVisible()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // Open actor sheet
      await page.click(`[data-document-id="${actor.id}"]`);
      await page.waitForSelector('.dcc.actor.sheet');

      // Get all tabs in the actor sheet
      const tabs = await page.locator('.dcc.actor.sheet .tabs [data-tab]').all();
      const tabNames = [];

      for (const tab of tabs) {
        const tabName = await tab.getAttribute('data-tab');
        if (tabName) tabNames.push(tabName);
      }

      // Take screenshot of each tab
      for (const tabName of tabNames) {
        await page.click(`[data-tab="${tabName}"]`);
        await page.waitForTimeout(500); // Allow animations and content to load

        const sanitizedActorName = actor.name.replace(/[^a-zA-Z0-9-]/g, '-');
        await expect(page.locator('.dcc.actor.sheet')).toHaveScreenshot(`${sanitizedActorName}-${tabName}.png`);
      }

      // Take screenshots of weapon dialogs
      // First, switch to equipment tab
      await page.click('[data-tab="equipment"]');
      await page.waitForTimeout(1000);

      await page.waitForSelector('.weapon .item-edit', { timeout: 2000, state: 'attached' }).catch(() => {});
      const weaponEditButtons = await page.locator('.weapon .item-edit').all();
      for (let i = 0; i < weaponEditButtons.length; i++) {
        try {
          await weaponEditButtons[i].scrollIntoViewIfNeeded();
          await weaponEditButtons[i].click({ timeout: 2000 });
          await page.waitForSelector('.dcc.sheet.item', { timeout: 2000 });
          const sanitizedActorName = actor.name.replace(/[^a-zA-Z0-9-]/g, '-');
          await expect(page.locator('.dcc.sheet.item')).toHaveScreenshot(`${sanitizedActorName}-weapon-${i}.png`);
          await page.click('.dcc.sheet.item .header-button.control.close');
          await page.waitForTimeout(300);
        } catch (error) {
          console.log(`Failed to capture weapon dialog for ${actor.name}: ${error.message}`);
        }
      }

      // Take screenshots of armor dialogs
      await page.waitForSelector('.armor .item-edit', { timeout: 2000, state: 'attached' }).catch(() => {});
      const armorEditButtons = await page.locator('.armor .item-edit').all();
      console.log(`Armor Edit Buttons for ${actor.name}: ${armorEditButtons}`);
      for (let i = 0; i < armorEditButtons.length; i++) {
        try {
          await armorEditButtons[i].scrollIntoViewIfNeeded();
          await armorEditButtons[i].click({ timeout: 2000 });
          await page.waitForSelector('.dcc.sheet.item', { timeout: 2000 });
          const sanitizedActorName = actor.name.replace(/[^a-zA-Z0-9-]/g, '-');
          await expect(page.locator('.dcc.sheet.item')).toHaveScreenshot(`${sanitizedActorName}-armor-${i}.png`);
          await page.click('.dcc.sheet.item .header-button.control.close');
          await page.waitForTimeout(300);
        } catch (error) {
          console.log(`Failed to capture armor dialog for ${actor.name}: ${error.message}`);
        }
      }

      // Close the sheet
      await page.keyboard.press('Escape');
    });
  });

  test('Custom Items screenshots', async ({ page }) => {
    // Close any welcome dialogs that might be open
    const dccDialog = page.locator('#dcc-welcome-dialog');
    if (await dccDialog.isVisible()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    const coreBookDialog = page.locator('#dcc-core-book-welcome-dialog');
    if (await coreBookDialog.isVisible()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Click on the items tab
    await page.click('a[data-tab="items"]');
    await page.waitForSelector('#items.active', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Open the custom-items folder
    await page.click('[data-folder-id] .folder-header h3:has-text("custom-items")');
    await page.waitForTimeout(1000);

    // Click on custom-treasure and take screenshot
    try {
      await page.click('[data-entry-id] h4:has-text("custom-treasure")');
      await page.waitForSelector('.dcc.sheet.item', { timeout: 2000 });
      await expect(page.locator('.dcc.sheet.item')).toHaveScreenshot('custom-treasure.png');
      await page.click('.dcc.sheet.item .header-button.control.close');
      await page.waitForTimeout(300);
    } catch (error) {
      console.log(`Failed to capture custom-treasure: ${error.message}`);
    }

    // Click on custom-weapon and take screenshot
    try {
      await page.click('[data-entry-id] h4:has-text("custom-sword")');
      await page.waitForSelector('.dcc.sheet.item', { timeout: 2000 });
      await expect(page.locator('.dcc.sheet.item')).toHaveScreenshot('custom-sword.png');
      await page.click('.dcc.sheet.item .header-button.control.close');
      await page.waitForTimeout(300);
    } catch (error) {
      console.log(`Failed to capture custom-sword: ${error.message}`);
    }
  });
});
