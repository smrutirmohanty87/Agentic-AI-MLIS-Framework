import { expect, Page } from '@playwright/test';

export class SalesforceNotesAttachmentsEwPage {
  constructor(private readonly page: Page) {}

  private async waitForLightningIdle() {
    await this.page.waitForLoadState('domcontentloaded');

    const textSpinner = this.page.getByText('Loading...').first();
    if (await textSpinner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(textSpinner).toBeHidden({ timeout: 120000 });
    }

    const lightningSpinner = this.page.locator('.slds-spinner_container:visible, lightning-spinner:visible').first();
    if (await lightningSpinner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(lightningSpinner).toBeHidden({ timeout: 120000 });
    }
  }

  async goto() {
    await this.page.goto('https://dualgroup--sitp.sandbox.lightning.force.com/');
  }

  async login(username: string, password: string) {
    await this.page.getByRole('textbox', { name: 'Username' }).fill(username);
    await this.page.getByRole('textbox', { name: 'Password' }).fill(password);
    await this.page.getByRole('button', { name: 'Log In' }).click();

    const appHeading = this.page.getByRole('heading', { name: /MLIS Underwriting/i }).first();
    const navBar = this.page.locator('one-app-nav-bar, .slds-global-header').first();
    await expect(appHeading.or(navBar).first()).toBeVisible({ timeout: 120000 });
    await this.waitForLightningIdle();
  }

  // Step 5-6: Global Search -> Search policy number -> open policy/submission link from grid.
  async searchPolicyAndOpenFromGlobalSearchGrid(policyReference: string) {
    const searchLauncher = this.page.locator('//*[@id="oneHeader"]/div[2]/div[2]/div/div/button').first();
    await expect(searchLauncher).toBeVisible({ timeout: 120000 });
    await searchLauncher.click();

    const dialogSearchInput = this.page
      .locator('[role="dialog"] input[type="search"]:visible, [role="dialog"] input[placeholder*="Search"]:visible')
      .first();
    const headerSearchInput = this.page
      .locator('[role="search"] input:visible, input[placeholder="Search..."]:visible')
      .first();
    const genericSearchbox = this.page.getByRole('searchbox').first();

    let activeSearchInput = dialogSearchInput;
    if (!(await dialogSearchInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      if (await headerSearchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        activeSearchInput = headerSearchInput;
      } else {
        await expect(genericSearchbox).toBeVisible({ timeout: 120000 });
        activeSearchInput = genericSearchbox;
      }
    }

    await activeSearchInput.fill(policyReference);
    await activeSearchInput.press('Enter');

    await this.waitForLightningIdle();

    const policyLinkInResults = this.page
      .locator('a:visible, [role="link"]:visible')
      .filter({ hasText: policyReference })
      .first();

    await expect(policyLinkInResults).toBeVisible({ timeout: 120000 });
    await policyLinkInResults.click();

    await this.waitForLightningIdle();
  }

  // Step 7-8: Related tab -> Notes & Attachments section.
  async openNotesAndAttachmentsFromRelatedTab() {
    const relatedTab = this.page.getByRole('tab', { name: 'Related' }).first();
    await expect(relatedTab).toBeVisible({ timeout: 120000 });
    await relatedTab.click();
    await this.waitForLightningIdle();

    const notesSectionLink = this.page
      .locator('article:visible, section:visible')
      .getByRole('link', { name: /Notes\s*&\s*Attachments/i })
      .first();

    for (let i = 0; i < 20; i += 1) {
      if (await notesSectionLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        break;
      }
      await this.page.mouse.wheel(0, 1200);
    }

    await expect(notesSectionLink).toBeVisible({ timeout: 120000 });
    await notesSectionLink.click();
    await this.waitForLightningIdle();

    await expect(this.page.getByRole('heading', { name: /Notes\s*&\s*Attachments/i }).first()).toBeVisible({ timeout: 120000 });
  }

  // Step 9: Open each document/link and close.
  async openEachNoteAttachmentAndClose() {
    const loadingMarker = this.page.getByText('Loading...').first();
    const refreshButton = this.page.getByRole('button', { name: /^Refresh$/i }).first();
    const documentNameLinksSelector =
      'table tbody tr th[scope="row"] a:visible, table tbody tr td[data-label="Title"] a:visible, table tbody tr td[data-label="Name"] a:visible, [role="row"] [data-label="Title"] a:visible, [role="row"] [data-label="Name"] a:visible';

    let total = 0;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      if (await loadingMarker.isVisible({ timeout: 1500 }).catch(() => false)) {
        await expect(loadingMarker).toBeHidden({ timeout: 180000 });
      }

      await this.waitForLightningIdle();

      const currentLinks = this.page.locator(documentNameLinksSelector);

      total = await currentLinks.count();
      if (total > 0) {
        break;
      }

      if (await refreshButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await refreshButton.click();
      }
      await this.page.waitForTimeout(3000);
    }

    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i += 1) {
      const documentLinks = this.page.locator(documentNameLinksSelector);
      const link = documentLinks.nth(i);
      await link.scrollIntoViewIfNeeded();

      const popupPromise = this.page.waitForEvent('popup', { timeout: 7000 }).catch(() => null);
      const previousUrl = this.page.url();
      await link.click();

      const popup = await popupPromise;
      if (popup) {
        await popup.waitForLoadState('domcontentloaded');
        await popup.close();
      } else {
        await this.waitForLightningIdle();

        const closeButton = this.page
          .locator('[role="dialog"] button:has-text("Close"), [role="dialog"] button[title*="Close"], [role="dialog"] button.slds-button_icon')
          .first();

        if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await closeButton.click();
        } else {
          if (this.page.url() !== previousUrl) {
            await this.page.goBack();
          }
          await this.page.keyboard.press('Escape').catch(() => undefined);
        }

        await this.waitForLightningIdle();
      }
    }
  }
}
