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

test.describe('Cancel and Reissue Policy', () => {
  test('should cancel and reissue a live policy end-to-end', async ({ page }) => {
    test.setTimeout(900000);
    test.slow();

    const caseRef = `E2E-CAN-REISSUE-${Date.now()}`;

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

    // Create a fresh policy in Broker Portal so cancel-and-reissue runs against a known live policy.
    await brokerLogin.goto();
    await brokerLogin.login(process.env.BROKER_USERNAME!, process.env.BROKER_PASSWORD!);
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

    // Login to Salesforce Portal
    await salesforce.goto();
    await salesforce.login(process.env.SALESFORCE_USERNAME!, process.env.SALESFORCE_PASSWORD!);

    // Global Search → Search & open policy record
    await salesforce.searchPolicyInGlobalSearch(policyNumber);

    // Navigate to Related tab
    await salesforce.openRelatedTab();

    // Scroll to Insurance Policy section & open the record
    await salesforce.openInsurancePolicyFromRelated();

    // Open Cancel and Reissue dialog from "Show more actions" menu
    await salesforce.openCancelAndReissueDialog();

    // Fill the Cancel and Reissue Details dialog and submit
    await salesforce.completeCancelAndReissueDialog({
      reasonForCR: 'User Error Correction',
      description: `Cancel and reissue test (${policyNumber})`,
    });

    // After submit, Salesforce redirects to Quote Journey → Final policy details (pre-filled)
    await salesforce.completeReissueFinalPolicyDetails();

    // Summary step — review and proceed to order
    await salesforce.completeReissueSummary();
  });
});
