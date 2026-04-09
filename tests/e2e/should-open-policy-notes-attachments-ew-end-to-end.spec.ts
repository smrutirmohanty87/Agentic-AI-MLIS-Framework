import { test } from '@playwright/test';
import {
  FinalPolicyDetailsPage,
  LoginPage,
  OrderDialog,
  PolicyIssuedPage,
  ProductSelectionPage,
  QuoteManagerPage,
  QuotesPage,
  StatementsOfFactPage,
  SummaryPage,
} from '../../src/pages/mlis-portal';
import { SalesforcePortalPage } from '../../src/pages/salesforce-cancellation';

test.describe('Policy Notes & Attachments Exploration E2E', () => {
  test('should create EW policy, open in Salesforce, and open/close Notes & Attachments docs', async ({ page }) => {
    test.setTimeout(1200000);
    test.slow();

    const caseRef = `E2E-NOTES-EW-${Date.now()}`;

    const brokerLogin = new LoginPage(page);
    const quoteManager = new QuoteManagerPage(page);
    const productSelection = new ProductSelectionPage(page);
    const statements = new StatementsOfFactPage(page);
    const quotes = new QuotesPage(page);
    const finalDetails = new FinalPolicyDetailsPage(page);
    const summary = new SummaryPage(page);
    const orderDialog = new OrderDialog(page);
    const policyIssued = new PolicyIssuedPage(page);

    const salesforce = new SalesforcePortalPage(page);

    // Step 1: Login to Broker Portal
    await brokerLogin.goto();
    await brokerLogin.login('girish.kulkarni+sit2t131a1@dualgroup.com', 'SIT2-t0131-01#');
    await quoteManager.expectLoaded();
    await quoteManager.acceptCookiesIfVisible();

    // Step 2: Create a policy (England & Wales)
    await quoteManager.startResidentialEnglandWalesQuote();
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
    const policyNumber = await policyIssued.getIssuedPolicyNumber();

    // Step 4: Login to Salesforce Portal
    await salesforce.goto();
    await salesforce.login('t-0116-mlis-uw-enhance-auto-provar@mlis.sit2', 'SIT2-t0116-02#');

    // Step 5-6: Global Search and open policy from grid by policy number
    await salesforce.searchPolicyAndOpenFromGlobalSearchGrid(policyNumber);

    // Step 7-8: Open Related tab and Notes & Attachments
    await salesforce.openNotesAndAttachmentsFromRelatedTab();

    // Step 9-10: Open each document/link and close; assert still on Notes & Attachments page
    await salesforce.openEachNoteAttachmentAndClose();
  });
});
