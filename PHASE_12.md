# Phase 12 — Barcode, POS hardware & accounting

## Barcode/POS
- Exact barcode/SKU scans add a product immediately when Enter is received.
- Search input is scanner-friendly for USB/Bluetooth keyboard-style scanners.
- Camera scanner uses the browser BarcodeDetector API when supported.
- Products can carry barcode/SKU identifiers.

## Balances/accounting
- Customer credit sales create receivables from total minus amount paid.
- Supplier purchases support payment method and amount paid.
- Separate account payments can be recorded against customers and suppliers.
- Customer receivables and supplier payables are derived from transaction/payment history.
- Accounting screen summarizes gross sales, customer collections, purchases and supplier payments.

## Important
Camera BarcodeDetector support varies by browser. USB/Bluetooth scanners that type into the POS field remain the broadest hardware path.
