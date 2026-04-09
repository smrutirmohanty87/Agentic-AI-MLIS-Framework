// spec: tests/mlis-policy-creation.plan.md
// seed: tests/seed.spec.ts

import { test } from '@playwright/test';
import {
  NiCommercialLoginPage,
  NiCommercialQuoteManagerPage,
  NiCommercialProductSelectionPage,
  NiCommercialStatementsOfFactPage,
  NiCommercialQuotesPage,
  NiCommercialFinalPolicyDetailsPage,
  NiCommercialSummaryPage,
  NiCommercialOrderDialog,
  NiCommercialPolicyIssuedPage,
} from '../../src/pages/mlis-portal-ni-commercial';

test.describe('End-to-End Policy Creation', () => {
  test('should create Commercial NI policy with multiple products end-to-end', async ({ page }) => {
    test.setTimeout(120000);
    const caseRef = `E2E-COMM-NI-MULTI-${Date.now()}`;

    const loginPage = new NiCommercialLoginPage(page);
    const quoteManager = new NiCommercialQuoteManagerPage(page);
    const productSelection = new NiCommercialProductSelectionPage(page);
    const statements = new NiCommercialStatementsOfFactPage(page);
    const quotes = new NiCommercialQuotesPage(page);
    const finalDetails = new NiCommercialFinalPolicyDetailsPage(page);
    const summary = new NiCommercialSummaryPage(page);
    const orderDialog = new NiCommercialOrderDialog(page);
    const policyIssued = new NiCommercialPolicyIssuedPage(page);

    // 1) Login with valid credentials and accept cookie consent. Verify Quote Manager dashboard loads.
    await loginPage.goto();
    await loginPage.login('girish.kulkarni+sit2t131a1@dualgroup.com', 'SIT2-t0131-01#');
    await quoteManager.expectLoaded();

    // 2) Click 'Northern Ireland Start quote' under Commercial. Verify Step 1 Product Selection loads.
    await quoteManager.startCommercialNorthernIrelandQuote();
    await productSelection.expectLoaded();

    // 3) Enter case reference and limit of indemnity 500000. Verify fields are populated.
    await productSelection.fillCaseReferenceAndLimit(caseRef, '500000');

    // 4) Select 4 products and click Proceed. Verify Step 2 Statements of Fact loads.
    await productSelection.selectProductsByIndex([1, 2, 3, 4]);
    await productSelection.proceed();
    await statements.expectLoaded();

    // 5) Confirm all statements of fact and click Proceed. Verify Step 3 Your Quotes loads.
    await statements.confirmAllStatements();
    await statements.proceed();
    await quotes.expectLoaded();

    // 6) Select the first available quote. Verify Step 4 Final Policy Details loads.
    await quotes.selectFirstQuote();
    await finalDetails.expectLoaded();

    // 7) Enter insured name, postcode, address line 1, town/city and click Proceed. Verify Step 5 Summary loads.
    await finalDetails.fillRequiredDetails();
    await finalDetails.proceed();
    await summary.expectLoaded();

    // 8) Verify summary data: case ref, limit £500,000.00, insured name, address, insurer premium.
    await summary.expectSummaryData(caseRef);

    // 9) Click 'Proceed to order', select today's date. Verify 'Order now' button becomes enabled.
    await summary.proceedToOrder();
    await orderDialog.selectTodayAndOrder();

    await policyIssued.expectPolicyIssued();
    await policyIssued.backToQuoteManager();
    await quoteManager.expectLoaded();
  });
});
