# Phase 13 — Accounting & Financial Intelligence

Implemented on Beta 5.

## Included
- Transaction-derived general ledger for sales, purchases, customer collections and supplier payments.
- Historical unit cost captured on sale items so COGS is based on the cost at the time of sale rather than today's product cost.
- Net sales, sales tax, COGS, gross profit and gross margin.
- Customer receivables and supplier payables derived from invoices, initial payments and later account payments.
- Cash-in/cash-out tracking and payment-method reconciliation for cash, M-Pesa, card and other.
- Date-range filtering for accounting and financial reports.
- Product-level revenue, COGS and gross-profit reporting.
- Inventory valuation at current recorded cost.
- Accounting payment ledger and operational ledger views.

## Accounting model
This phase is an operational management accounting layer, not a certified double-entry accounting package. Tax treatment is based on the tax amount recorded on each transaction. COGS uses the stored sale-item unit cost; legacy sales without a stored unit cost fall back to the product's current cost price.

## Validation
Run locally after installing dependencies:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```
