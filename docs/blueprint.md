# Inventory Tracker blueprint

## Product goal
A lightweight stock, sales and purchasing application for small businesses, with a web/PWA-first experience and an AI assistant.

## Core domain
- Business
- Members / roles
- Products
- Categories
- Suppliers
- Customers
- Stock movements
- Purchases
- Sales
- Payments
- Reports
- AI insights

## Firestore layout
```text
users/{userId}
businesses/{businessId}
businesses/{businessId}/members/{userId}
businesses/{businessId}/products/{productId}
businesses/{businessId}/categories/{categoryId}
businesses/{businessId}/suppliers/{supplierId}
businesses/{businessId}/customers/{customerId}
businesses/{businessId}/stockMovements/{movementId}
businesses/{businessId}/purchases/{purchaseId}
businesses/{businessId}/sales/{saleId}
```

## Stock rule
Stock is changed through business events rather than arbitrary edits:

`opening + purchases + stock-in + returns - sales - stock-out - damage ± adjustments = current quantity`

## Current beta
The application runs without Firebase in Demo Mode using browser localStorage. When Firebase environment variables are configured, authentication and product persistence use Firebase. Transaction-safe Firestore stock updates and full collection synchronization remain a later phase.
