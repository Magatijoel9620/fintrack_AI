# Phase 10 — POS / Sales Cart

Phase 10 turns the transaction screen into a practical multi-item checkout workflow.

## Included
- Multi-product cart
- Product search by name, SKU, or barcode
- Quantity increment/decrement
- Stock-limit validation on sales
- Customer selection
- Discount amount
- Tax percentage
- Cash / M-Pesa / card / credit / other payment selection
- Amount tendered and change calculation
- Credit amount-paid and balance-due calculation
- Custom invoice/reference number with automatic fallback
- Purchase cart workflow using product cost prices
- Recent transaction history

## Product barcode support
Products now have an optional `barcode` field. USB/Bluetooth barcode scanners that behave like keyboard input can be used directly in the POS search box.

Camera-based barcode scanning is intentionally left for the next barcode/POS phase so that the core checkout flow stays stable.
