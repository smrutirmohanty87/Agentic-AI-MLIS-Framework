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
import { BrokerPortalPage } from '../../src/pages/broker-portal-policy';
import { SalesforcePortalPage } from '../../src/pages/salesforce-cancellation';

test.describe('Cancellation from Inception - Full Premium Return', () => {
  test('should cancel policy from inception with full premium return', async ({ page }) => {
    test.setTimeout(900000);
    test.slow();

    const caseRef = `E2E-CAN-INFULL-${Date.now()}`;

    const brokerLogin = new LoginPage(page);
    const quoteManager = new QuoteManagerPage(page);
    const productSelection = new ProductSelectionPage(page);
    const statements = new StatementsOfFactPage(page);
    const quotes = new QuotesPage(page);
    const finalDetails = new FinalPolicyDetailsPage(page);
    const summary = new SummaryPage(page);
    const orderDialog = new OrderDialog(page);
    const policyIssued = new PolicyIssuedPage(page);

    const brokerPortal = new BrokerPortalPage(page);
    const salesforce = new SalesforcePortalPage(page);

    // Create a fresh policy in Broker Portal so cancellation runs against a known live policy.
    await brokerLogin.goto();
    await brokerLogin.login('girish.kulkarni+sit2t131a1@dualgroup.com', 'SIT2-t0131-01#');
    await quoteManager.expectLoaded();
    await quoteManager.acceptCookiesIfVisible();

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

    await policyIssued.expectPolicyIssued();
    const policyNumber = await policyIssued.getIssuedPolicyNumber();
    await policyIssued.backToQuoteManager();

    // Verify policy is live before cancelling.
    await brokerPortal.expectQuoteManagerLoaded();
    await brokerPortal.searchPolicy(policyNumber);
    await brokerPortal.expectPolicyStatus(policyNumber, 'Live');

    // Step 4: Login to Salesforce Portal
    await salesforce.goto();
    await salesforce.login('t-0116-mlis-uw-enhance-auto-provar@mlis.sit2', 'SIT2-t0116-02#');

    // Step 5-6: Global Search → Search & open policy record
    await salesforce.searchPolicyInGlobalSearch(policyNumber);

    // Step 7: Navigate to Related tab
    await salesforce.openRelatedTab();

    // Step 8-9: Scroll to Insurance Policy section & open the record
    await salesforce.openInsurancePolicyFromRelated();

    // Step 10: Perform full policy cancellation
    await salesforce.fillCancelPolicyStep1Direct({
  category: 'Cancel the Policy from Inception',
  instigatedBy: 'Customer',
  reason: 'Cover No Longer Required',
  notes: `Policy cancellation from inception - full premium return test (${policyNumber})`,
});});
});
