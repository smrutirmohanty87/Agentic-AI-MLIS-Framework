import { expect, Page } from '@playwright/test';

export class SalesforcePortalPage {
  constructor(private readonly page: Page) {}

  private async clickWhenUiReady(target: ReturnType<Page['locator']>) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await this.waitForLightningIdle();
      try {
        await target.click({ timeout: 10000 });
        return;
      } catch (error) {
        if (attempt === 4) {
          throw error;
        }
        await this.page.waitForTimeout(750);
      }
    }
  }

  /**
   * Resilient Salesforce Lightning combobox selection.
   * Handles: slow option loading, DOM re-renders after selection, stale elements.
   * NEVER uses selectOption — clicks the combobox to open, waits for options overlay, clicks by text.
   */
  private async selectLightningCombobox(label: string, optionText: string) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.waitForLightningIdle();

        // Re-query combobox each attempt (DOM may have re-rendered)
        const combobox = this.page.getByRole('combobox', { name: label });
        await expect(combobox).toBeVisible({ timeout: 15000 });
        await combobox.click();

        // Wait for the floating options overlay to appear
        const option = this.page.getByRole('option', { name: optionText });
        await expect(option).toBeVisible({ timeout: 10000 });
        await option.click();

        // Wait for DOM to re-render after selection
        await this.waitForLightningIdle();
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        // Dismiss any stuck overlay by pressing Escape, then retry
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(1000);
      }
    }
  }

  private async openRecordFromHeaderGlobalSearch(policyReference: string) {
    // Use the exact XPath for the Salesforce header global search button
    const searchLauncher = this.page.locator('//*[@id="oneHeader"]/div[2]/div[2]/div/div/button').first();

    await expect(searchLauncher).toBeVisible({ timeout: 15000 });
    await this.clickWhenUiReady(searchLauncher);

    // After clicking the search launcher, Salesforce opens a dialog with a search input
    const dialogSearchInput = this.page
      .locator('[role="dialog"] input[type="search"]:visible, [role="dialog"] input[placeholder*="Search"]:visible')
      .first();
    const scopedSearchInput = this.page
      .locator('[role="search"] input:visible, [data-aura-class*="search"] input:visible, input[placeholder="Search..."]:visible')
      .first();
    const headerSearchInput = this.page.getByRole('searchbox').first();

    let activeSearchInput = dialogSearchInput;
    if (!(await dialogSearchInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      if (await scopedSearchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        activeSearchInput = scopedSearchInput;
      } else {
        await expect(headerSearchInput).toBeVisible({ timeout: 15000 });
        activeSearchInput = headerSearchInput;
      }
    }

    await activeSearchInput.fill(policyReference);
    await activeSearchInput.press('Enter');
    await this.waitForLightningIdle();

    const searchResult = this.page
      .locator('a:visible, [role="option"]:visible, [role="link"]:visible')
      .filter({ hasText: policyReference })
      .first();
    await expect(searchResult).toBeVisible({ timeout: 30000 });
    await this.clickWhenUiReady(searchResult);
    await this.waitForLightningIdle();
  }

  async goto() {
    await this.page.goto('https://dualgroup--sitp.sandbox.lightning.force.com/');
  }

  async login(username: string, password: string) {
    await this.page.getByRole('textbox', { name: 'Username' }).fill(username);
    await this.page.getByRole('textbox', { name: 'Password' }).fill(password);
    await this.page.getByRole('button', { name: 'Log In' }).click();
    await this.expectAppLoaded();
    await this.expectUnderwritingNavigation();
  }

  async expectUnderwritingNavigation() {
    await expect(this.page.getByRole('link', { name: 'Accounts' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('link', { name: 'Contacts' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('link', { name: 'Submissions' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('link', { name: 'Insurance Policies' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('link', { name: 'Quote Journey' })).toBeVisible({ timeout: 60000 });
  }

  /** Step 5-6: Global Search → search for policy number, wait for results, click submission link */
  async searchPolicyInGlobalSearch(policyReference: string) {
    // Click the global search launcher button
    const searchLauncher = this.page.locator('//*[@id="oneHeader"]/div[2]/div[2]/div/div/button').first();
    await expect(searchLauncher).toBeVisible({ timeout: 30000 });
    await this.clickWhenUiReady(searchLauncher);

    // Wait for search input to appear (dialog or inline)
    const dialogSearchInput = this.page
      .locator('[role="dialog"] input[type="search"]:visible, [role="dialog"] input[placeholder*="Search"]:visible')
      .first();
    const fallbackSearchInput = this.page
      .locator('[role="search"] input:visible, input[placeholder="Search..."]:visible')
      .first();
    const headerSearchInput = this.page.getByRole('searchbox').first();

    let activeSearchInput = dialogSearchInput;
    if (!(await dialogSearchInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      if (await fallbackSearchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        activeSearchInput = fallbackSearchInput;
      } else {
        await expect(headerSearchInput).toBeVisible({ timeout: 15000 });
        activeSearchInput = headerSearchInput;
      }
    }

    // Type policy number and submit search
    await activeSearchInput.fill(policyReference);
    await activeSearchInput.press('Enter');

    // Wait patiently for the search results page to load (app is slow)
    await this.waitForLightningIdle();
    await this.page.waitForLoadState('load');
    await this.waitForLightningIdle();

    // Wait for the Submissions section heading to appear in search results
    const submissionsHeading = this.page.getByRole('heading', { name: 'Submissions' }).first();
    await expect(submissionsHeading).toBeVisible({ timeout: 120000 });
    await this.waitForLightningIdle();

    // Click the first submission link in the Submission Name column of the results grid
    const submissionLink = this.page.locator('table a[href*="Submission"], table a[data-refid]').first();
    const fallbackLink = this.page.locator('table tbody tr:first-child th a, table tbody tr:first-child td:first-child a').first();
    const anyTableLink = this.page.locator('table a:visible').first();

    if (await submissionLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await this.clickWhenUiReady(submissionLink);
    } else if (await fallbackLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.clickWhenUiReady(fallbackLink);
    } else {
      await expect(anyTableLink).toBeVisible({ timeout: 30000 });
      await this.clickWhenUiReady(anyTableLink);
    }

    // Wait for submission record page to load
    await this.waitForLightningIdle();
    await expect(this.page.getByRole('tab', { name: 'Related' }).first()).toBeVisible({ timeout: 120000 });
  }

  async searchAndOpenSubmission(policyReference: string) {
    const escapedPolicy = policyReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const launcher = this.page.locator('//*[@id="oneHeader"]/div[2]/div[2]/div/div/button').first();
      if (await launcher.isVisible({ timeout: 5000 }).catch(() => false)) {
        await this.clickWhenUiReady(launcher);
      }

      const searchInput = this.page
        .locator('[role="dialog"] input[type="search"]:visible, [role="search"] input:visible, input[placeholder="Search..."]:visible')
        .first();
      await expect(searchInput).toBeVisible({ timeout: 15000 });
      await searchInput.fill(policyReference);
      await searchInput.press('Enter');
      await this.waitForLightningIdle();

      const chip = this.page.getByRole('button', { name: new RegExp(`Search:\\s*${escapedPolicy}`) }).first();
      if (await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.clickWhenUiReady(chip);
      }

      const result = this.page
        .locator('a:visible, [role="option"]:visible, [role="link"]:visible')
        .filter({ hasText: policyReference })
        .first();

      if (await result.isVisible({ timeout: 10000 }).catch(() => false)) {
        await this.clickWhenUiReady(result);
        await this.waitForLightningIdle();
        await expect(this.page.getByRole('tab', { name: 'Related' }).first()).toBeVisible({ timeout: 60000 });
        return;
      }

      if (attempt < 6) {
        await this.page.waitForTimeout(5000);
      }
    }

    throw new Error(`Could not open submission from global search for ${policyReference}.`);
  }

  async openSubmissionFromSubmissionsTab(policyReference: string) {
    await this.page.getByRole('link', { name: 'Submissions' }).click();
    await expect(this.page.getByRole('heading', { name: /Submissions/i }).first()).toBeVisible({ timeout: 60000 });
    await this.waitForLightningIdle();

    const listSearch = this.page.getByRole('searchbox', { name: 'Search this list...' }).first();
    await expect(listSearch).toBeVisible({ timeout: 60000 });
    await listSearch.fill(policyReference);
    await listSearch.press('Enter');
    await this.waitForLightningIdle();

    const matchingSubmission = this.page.getByRole('link', { name: new RegExp(policyReference, 'i') }).first();
    const firstRowLink = this.page.locator('[role="rowheader"] a:visible').first();

    if (await matchingSubmission.isVisible({ timeout: 8000 }).catch(() => false)) {
      await this.clickWhenUiReady(matchingSubmission);
    } else {
      await expect(firstRowLink).toBeVisible({ timeout: 60000 });
      await this.clickWhenUiReady(firstRowLink);
    }

    await this.waitForLightningIdle();
    await expect(this.page.getByRole('tab', { name: 'Related' }).first()).toBeVisible({ timeout: 60000 });
  }

  async searchAndOpenInsurancePolicy(policyReference: string) {
    await this.page.getByRole('link', { name: 'Insurance Policies' }).click();
    await expect(this.page.getByRole('heading', { name: /Insurance Policies/i }).first()).toBeVisible({ timeout: 60000 });
    await this.waitForLightningIdle();

    const listSearch = this.page.getByRole('searchbox', { name: 'Search this list...' }).first();
    await expect(listSearch).toBeVisible({ timeout: 60000 });
    await listSearch.fill(policyReference);
    await listSearch.press('Enter');
    await this.waitForLightningIdle();

    const policyLink = this.page.getByRole('link', { name: new RegExp(policyReference, 'i') }).first();
    const firstRowLink = this.page.locator('[role="rowheader"] a:visible').first();

    if (await policyLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await this.clickWhenUiReady(policyLink);
    } else {
      await expect(firstRowLink).toBeVisible({ timeout: 60000 });
      await this.clickWhenUiReady(firstRowLink);
    }

    await expect(this.page.getByRole('heading', { name: /Insurance Policy/i })).toBeVisible({ timeout: 60000 });
    await this.waitForLightningIdle();
  }

  /** Step 7: Navigate to the Related tab */
  async openRelatedTab() {
    const relatedTab = this.page.getByRole('tab', { name: 'Related' }).first();
    await expect(relatedTab).toBeVisible({ timeout: 60000 });
    await this.clickWhenUiReady(relatedTab);
    await this.waitForLightningIdle();
  }

  /** Steps 8-9: Scroll to Insurance Policy section and open the record */
  async openInsurancePolicyFromRelated() {
    // The Insurance Policy record may take time to sync from Broker Portal to Salesforce.
    // Reload the page to pick up the latest server-side data before looking for the record.
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.waitForLightningIdle();

    // Re-click Related tab after reload since it resets to default tab
    const relatedTab = this.page.getByRole('tab', { name: 'Related' }).first();
    await expect(relatedTab).toBeVisible({ timeout: 60000 });
    await this.clickWhenUiReady(relatedTab);
    await this.waitForLightningIdle();

    // The Insurance Policies heading becomes a link with a count (e.g. "Insurance Policies (1)")
    // only when records exist. Wait generously for the data sync to complete.
    const insurancePoliciesLink = this.page
      .locator('article:visible')
      .getByRole('link', { name: /Insurance Policies/i })
      .first();

    // Scroll down to bring the Insurance Policies section into view
    for (let i = 0; i < 15; i += 1) {
      if (await insurancePoliciesLink.isVisible().catch(() => false)) {
        break;
      }
      await this.page.mouse.wheel(0, 1200);
      await this.page.waitForTimeout(500);
    }

    await expect(insurancePoliciesLink).toBeVisible({ timeout: 120000 });
    await this.clickWhenUiReady(insurancePoliciesLink);
    await this.waitForLightningIdle();

    // Click the Insurance Policy record from the list view
    const policyLinkByName = this.page.getByRole('link', { name: /DA-MLI-|DAU\//i }).first();
    const firstRowLink = this.page.locator('[role="rowheader"] a:visible').first();

    if (await policyLinkByName.isVisible({ timeout: 10000 }).catch(() => false)) {
      await this.clickWhenUiReady(policyLinkByName);
    } else {
      await expect(firstRowLink).toBeVisible({ timeout: 60000 });
      await this.clickWhenUiReady(firstRowLink);
    }

    // Verify Insurance Policy record loaded with expected state
    await expect(this.page.getByRole('heading', { name: /Insurance Policy/i })).toBeVisible({ timeout: 60000 });
    await this.waitForLightningIdle();

    const inForceOption = this.page.getByRole('option', { name: 'In Force' });
    await expect(inForceOption).toBeVisible({ timeout: 60000 });
    await expect(inForceOption).toHaveAttribute('aria-selected', 'true', { timeout: 60000 });

    await expect(this.page.getByRole('button', { name: 'Create MTA' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: 'Create Claim' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: 'New Note' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: 'Show more actions' })).toBeVisible({ timeout: 60000 });
  }

  async expectInsurancePolicyRecordLoaded() {
    await expect(this.page.getByRole('heading', { name: /Insurance Policy/i })).toBeVisible({ timeout: 60000 });
    await this.waitForLightningIdle();

    const inForceOption = this.page.getByRole('option', { name: 'In Force' });
    await expect(inForceOption).toBeVisible({ timeout: 60000 });

    await expect(this.page.getByRole('button', { name: 'Create MTA' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: 'Create Claim' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: 'New Note' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: 'Show more actions' })).toBeVisible({ timeout: 60000 });
  }

  async openCancelPolicyWizard() {
    await this.page.getByRole('button', { name: 'Show more actions' }).click();
    await expect(this.page.getByRole('menuitem', { name: 'Cancel Policy' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('menuitem', { name: 'Cancel and Reissue' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('menuitem', { name: 'Change Owner' })).toBeVisible({ timeout: 60000 });
    await this.page.getByRole('menuitem', { name: 'Cancel Policy' }).click();

    await expect(this.page.getByRole('heading', { name: 'Cancel Policy' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: /Cancel Policy In Progress/i })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('progressbar', { name: 'Steps' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('textbox', { name: 'Effective Date' })).toBeDisabled({ timeout: 60000 });
  }

  async openCancelAndReissueWizard() {
    await this.page.getByRole('button', { name: 'Show more actions' }).click();
    await expect(this.page.getByRole('menuitem', { name: 'Cancel and Reissue' })).toBeVisible({ timeout: 60000 });
    await this.page.getByRole('menuitem', { name: 'Cancel and Reissue' }).click();

    const cancelReissueHeading = this.page.getByRole('heading', { name: /Cancel.*Reissue|Cancel.*Rewrite/i }).first();
    await expect(cancelReissueHeading).toBeVisible({ timeout: 60000 });
  }

  async completeCancelFromInceptionStep1(notes: string) {
    // Select Cancellation Category — wait for DOM re-render after each selection
    await this.selectLightningCombobox('*Cancellation Category', 'Cancel the Policy from Inception');

    // Dynamic fields appear after category selection
    const cancellationDate = this.page.getByRole('textbox', { name: 'Cancellation Effective Date' });
    await expect(cancellationDate).toBeVisible({ timeout: 15000 });
    await expect(cancellationDate).toBeDisabled({ timeout: 10000 });
    await expect(this.page.getByRole('textbox', { name: 'Cooling Period Display' })).toHaveValue('Inside Cooling-Off Period', {
      timeout: 15000,
    });

    // Select Instigated By — DOM re-renders, Reason dropdown appears dynamically
    await this.selectLightningCombobox('*Cancellation Instigated By', 'Customer');
    await expect(this.page.getByRole('combobox', { name: '*Cancellation Reason' })).toBeVisible({ timeout: 15000 });

    // Select Reason — DOM re-renders, Notes field appears dynamically
    await this.selectLightningCombobox('*Cancellation Reason', 'Cover No Longer Required');
    await expect(this.page.getByRole('textbox', { name: '*Cancellation Notes/Narrative' })).toBeVisible({ timeout: 15000 });

    // Fill notes and proceed
    await this.page.getByRole('textbox', { name: '*Cancellation Notes/Narrative' }).fill(notes);
    await this.waitForLightningIdle();
    await this.page.getByRole('button', { name: 'Next' }).click();

    // Verify Step 2 loaded
    await expect(this.page.getByRole('heading', { name: 'Enter Premiums' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: /Cancel Policy Completed/i })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: /Enter Premiums In Progress/i })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('progressbar', { name: 'Steps' })).toContainText('100%', { timeout: 60000 });
  }

  async completeCancelMidtermStep1(notes: string, cancellationDate?: string) {
    // Select Cancellation Category — wait for DOM re-render
    await this.selectLightningCombobox('*Cancellation Category', 'Cancel the Policy Midterm');

    // Dynamic fields: editable date picker + Outside Cooling-Off Period
    const dateField = this.page.getByRole('textbox', { name: 'Cancellation Effective Date' });
    await expect(dateField).toBeVisible({ timeout: 15000 });
    await expect(dateField).toBeEnabled({ timeout: 10000 });
    await expect(this.page.getByRole('textbox', { name: 'Cooling Period Display' })).toHaveValue('Outside Cooling-Off Period', {
      timeout: 15000,
    });

    // Set cancellation date (defaults to today)
    const dateValue = cancellationDate ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await dateField.fill(dateValue);
    await dateField.press('Tab');
    await this.waitForLightningIdle();

    // Select Instigated By — DOM re-renders, Reason dropdown appears
    await this.selectLightningCombobox('*Cancellation Instigated By', 'Customer');
    await expect(this.page.getByRole('combobox', { name: '*Cancellation Reason' })).toBeVisible({ timeout: 15000 });

    // Select Reason — DOM re-renders, Notes field appears
    await this.selectLightningCombobox('*Cancellation Reason', 'Product Too Expensive');
    await expect(this.page.getByRole('textbox', { name: '*Cancellation Notes/Narrative' })).toBeVisible({ timeout: 15000 });

    // Fill notes and proceed
    await this.page.getByRole('textbox', { name: '*Cancellation Notes/Narrative' }).fill(notes);
    await this.waitForLightningIdle();
    await this.page.getByRole('button', { name: 'Next' }).click();

    // Verify Step 2 loaded
    await expect(this.page.getByRole('heading', { name: 'Enter Premiums' })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: /Cancel Policy Completed/i })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('button', { name: /Enter Premiums In Progress/i })).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('progressbar', { name: 'Steps' })).toContainText('100%', { timeout: 60000 });
  }
  

  async completePremiumStepWithTaxCalculation() {
    await this.selectLightningCombobox('Do you want to return the full premium?', 'Yes');

    const cancellationReturnPremium = this.page.getByRole('spinbutton', { name: 'Cancellation Return Premium' });
    await expect(cancellationReturnPremium).toHaveValue(/-?\d+\.?\d*/, { timeout: 60000 });
    await expect(this.page.getByRole('spinbutton', { name: 'Gross Written Premium' })).toBeDisabled({ timeout: 60000 });

    await expect(this.page.getByText('Insurance Premium Tax').first()).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('gridcell', { name: 'Non Life' }).first()).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByText('Remitted to DUAL').first()).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByText('Insured').first()).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByText('Insurer').first()).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByText('No').first()).toBeVisible({ timeout: 60000 });
    await expect(this.page.getByRole('textbox', { name: 'Tax Jurisdiction' })).toHaveValue('United Kingdom', { timeout: 60000 });
    await expect(this.page.getByRole('textbox', { name: 'Quote Currency' })).toHaveValue('GBP', { timeout: 60000 });

    await this.page.getByRole('button', { name: 'Calculate Tax' }).click();
    await this.acceptTaxDialogIfPresent();
    await expect(this.page.getByRole('heading', { name: 'Tax Details' })).toBeVisible({ timeout: 60000 });

    const totalTaxAsSpin = this.page.getByRole('spinbutton', { name: 'Total Tax Value' }).first();
    const totalTaxAsText = this.page.getByRole('textbox', { name: 'Total Tax Value' }).first();

    if (await totalTaxAsSpin.isVisible().catch(() => false)) {
      await expect(totalTaxAsSpin).toHaveValue(/\d+\.?\d*/, { timeout: 60000 });
      return;
    }

    if (await totalTaxAsText.isVisible().catch(() => false)) {
      await expect(totalTaxAsText).toHaveValue(/\d+\.?\d*/, { timeout: 60000 });
      return;
    }

    await expect(this.page.getByText('Insurance Premium Tax').first()).toBeVisible({ timeout: 60000 });
  }

  private async acceptTaxDialogIfPresent() {
    let browserDialogHandled = false;
    const dialogHandler = async (dialog: { accept: () => Promise<void> }) => {
      browserDialogHandled = true;
      await dialog.accept();
    };

    this.page.once('dialog', dialogHandler);

    const okButton = this.page.getByRole('button', { name: /^OK$/i }).first();
    const dialogContainer = this.page.locator('[role="dialog"]:visible').first();

    if (await dialogContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
      if (await okButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await okButton.click();
      }
    } else if (await okButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await okButton.click();
    }

    if (!browserDialogHandled) {
      this.page.removeListener('dialog', dialogHandler);
    }
  }

  async submitCancellation() {
    await this.page.getByRole('button', { name: 'Next' }).click();
    await this.waitForLightningIdle();

    const pathCancelled = this.page.getByRole('option', { name: 'Cancelled' });
    await expect(pathCancelled).toBeVisible({ timeout: 120000 });
  }

  async completeCancelAndReissueFlow(notes: string) {
    await this.completeCancelFromInceptionStep1(notes);
    await this.completePremiumStepWithTaxCalculation();
    await this.submitCancellation();
  }

  async expectPolicyStatusCancelled() {
    const pathCancelled = this.page.getByRole('option', { name: 'Cancelled' });
    await expect(pathCancelled).toHaveAttribute('aria-selected', 'true', { timeout: 120000 });
  }

  private async expectAppLoaded() {
    // Wait for any of the common Salesforce app-loaded indicators
    const appHeading = this.page.getByRole('heading', { name: 'MLIS Underwriting' });
    const navBar = this.page.locator('one-app-nav-bar, .slds-global-header');
    const searchButton = this.page.locator('//*[@id="oneHeader"]/div[2]/div[2]/div/div/button').first();

    await expect(appHeading.or(navBar).or(searchButton).first()).toBeVisible({ timeout: 60000 });
    await this.waitForLightningIdle();
  }

  private async waitForLightningIdle() {
    await this.page.waitForLoadState('domcontentloaded');
    const textSpinner = this.page.getByText('Loading...').first();
    if (await textSpinner.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expect(textSpinner).toBeHidden({ timeout: 60000 });
    }

    const lightningSpinner = this.page.locator('.slds-spinner_container:visible, lightning-spinner:visible').first();
    if (await lightningSpinner.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expect(lightningSpinner).toBeHidden({ timeout: 60000 });
    }
  }
}