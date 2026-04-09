import { expect, test } from '@playwright/test';
import {
  CommercialFinalPolicyDetailsPage,
  CommercialLoginPage,
  CommercialOrderDialog,
  CommercialPolicyIssuedPage,
  CommercialProductSelectionPage,
  CommercialQuoteManagerPage,
  CommercialQuotesPage,
  CommercialStatementsOfFactPage,
  CommercialSummaryPage,
} from '../../src/pages/mlis-portal-commercial';
import {
  ScotlandCommercialFinalPolicyDetailsPage,
  ScotlandCommercialLoginPage,
  ScotlandCommercialOrderDialog,
  ScotlandCommercialPolicyIssuedPage,
  ScotlandCommercialProductSelectionPage,
  ScotlandCommercialQuoteManagerPage,
  ScotlandCommercialQuotesPage,
  ScotlandCommercialStatementsOfFactPage,
  ScotlandCommercialSummaryPage,
} from '../../src/pages/mlis-portal-scotland-commercial';
import { SalesforceNotesAttachmentsEwPage } from '../../src/pages/salesforce-notes-attachments-ew';

test.describe('Policy Notes & Attachments Exploration - Commercial', () => {
  test('should create Commercial EW policy, open in Salesforce, and open/close Notes & Attachments docs', async ({ page }) => {
    test.setTimeout(1200000);
    test.slow();

    const caseRef = `E2E-NOTES-COMM-EW-${Date.now()}`;

    const brokerLogin = new CommercialLoginPage(page);
    const quoteManager = new CommercialQuoteManagerPage(page);
    const productSelection = new CommercialProductSelectionPage(page);
    const statements = new CommercialStatementsOfFactPage(page);
    const quotes = new CommercialQuotesPage(page);
    const finalDetails = new CommercialFinalPolicyDetailsPage(page);
    const summary = new CommercialSummaryPage(page);
    const orderDialog = new CommercialOrderDialog(page);
    const policyIssued = new CommercialPolicyIssuedPage(page);
    const salesforce = new SalesforceNotesAttachmentsEwPage(page);

    // Step 1: Login to Broker Portal
    await brokerLogin.goto();
    await brokerLogin.login('girish.kulkarni+sit2t131a1@dualgroup.com', 'SIT2-t0131-01#');
    await quoteManager.expectLoaded();
    await quoteManager.acceptCookiesIfVisible();

    // Step 2: Create a policy (Commercial England & Wales)
    await quoteManager.startCommercialEnglandWalesQuote();
    await productSelection.expectLoaded();
    await productSelection.fillCaseReferenceAndLimit(caseRef, '500000');
    await productSelection.selectProductsByIndex([1]);
    await productSelection.proceed();

    await statements.expectLoaded();
    await statements.confirmAllStatements();
    await statements.proceed();

    await quotes.expectLoaded();
    await quotes.selectFirstQuote();

    await finalDetails.expectLoaded();
    await finalDetails.fillRequiredDetails();
    await finalDetails.proceed();

    await summary.expectLoaded();
    await summary.expectSummaryData(caseRef);
    await summary.proceedToOrder();
    await orderDialog.selectTodayAndOrder();

    // Step 3: Capture policy number
    await policyIssued.expectPolicyIssued();
    const policyLabel = page.locator('strong', { hasText: 'Policy number' });
    await expect(policyLabel).toBeVisible({ timeout: 60000 });
    const policyNumber = (await policyLabel.locator('xpath=following::p[1]').first().innerText()).trim();

    // Step 4: Login to Salesforce Portal
    await salesforce.goto();
    await salesforce.login('t-0116-mlis-uw-enhance-auto-provar@mlis.sit2', 'SIT2-t0116-02#');

    // Step 5-6: Global Search and open policy from grid by policy number
    await salesforce.searchPolicyAndOpenFromGlobalSearchGrid(policyNumber);

    // Step 7-8: Open Related tab and Notes & Attachments
    await salesforce.openNotesAndAttachmentsFromRelatedTab();

    // Step 9-10: Open each document/link and close; assert still on Notes & Attachments page
    await salesforce.openEachNoteAttachmentAndClose();
    await expect(page.getByRole('heading', { name: /Notes\s*&\s*Attachments/i }).first()).toBeVisible({ timeout: 120000 });
  });

  test('should create Commercial Scotland policy, open in Salesforce, and open/close Notes & Attachments docs', async ({ page }) => {
    test.setTimeout(1200000);
    test.slow();

    const caseRef = `E2E-NOTES-COMM-SCOT-${Date.now()}`;

    const brokerLogin = new ScotlandCommercialLoginPage(page);
    const quoteManager = new ScotlandCommercialQuoteManagerPage(page);
    const productSelection = new ScotlandCommercialProductSelectionPage(page);
    const statements = new ScotlandCommercialStatementsOfFactPage(page);
    const quotes = new ScotlandCommercialQuotesPage(page);
    const finalDetails = new ScotlandCommercialFinalPolicyDetailsPage(page);
    const summary = new ScotlandCommercialSummaryPage(page);
    const orderDialog = new ScotlandCommercialOrderDialog(page);
    const policyIssued = new ScotlandCommercialPolicyIssuedPage(page);
    const salesforce = new SalesforceNotesAttachmentsEwPage(page);

    // Step 1: Login to Broker Portal
    await brokerLogin.goto();
    await brokerLogin.login('girish.kulkarni+sit2t131a1@dualgroup.com', 'SIT2-t0131-01#');
    await quoteManager.expectLoaded();
    await quoteManager.acceptCookiesIfVisible();

    // Step 2: Create a policy (Commercial Scotland)
    await quoteManager.startCommercialScotlandQuote();
    await productSelection.expectLoaded();
    await productSelection.fillCaseReferenceAndLimit(caseRef, '500000');
    await productSelection.selectProductsByIndex([1]);
    await productSelection.proceed();

    await statements.expectLoaded();
    await statements.confirmAllStatements();
    await statements.proceed();

    await quotes.expectLoaded();
    await quotes.selectFirstQuote();

    await finalDetails.expectLoaded();
    await finalDetails.fillRequiredDetails();
    await finalDetails.proceed();

    await summary.expectLoaded();
    await summary.expectSummaryData(caseRef);
    await summary.proceedToOrder();
    await orderDialog.selectTodayAndOrder();

    // Step 3: Capture policy number
    await policyIssued.expectPolicyIssued();
    const policyLabel = page.locator('strong', { hasText: 'Policy number' });
    await expect(policyLabel).toBeVisible({ timeout: 60000 });
    const policyNumber = (await policyLabel.locator('xpath=following::p[1]').first().innerText()).trim();

    // Step 4: Login to Salesforce Portal
    await salesforce.goto();
    await salesforce.login('t-0116-mlis-uw-enhance-auto-provar@mlis.sit2', 'SIT2-t0116-02#');

    // Step 5-6: Global Search and open policy from grid by policy number
    await salesforce.searchPolicyAndOpenFromGlobalSearchGrid(policyNumber);

    // Step 7-8: Open Related tab and Notes & Attachments
    await salesforce.openNotesAndAttachmentsFromRelatedTab();

    // Step 9-10: Open each document/link and close; assert still on Notes & Attachments page
    await salesforce.openEachNoteAttachmentAndClose();
    await expect(page.getByRole('heading', { name: /Notes\s*&\s*Attachments/i }).first()).toBeVisible({ timeout: 120000 });
  });
});