# FinAI profile, navigation and settings uplift

## What changed

### Personal account profile — separate from business settings
- Added a dedicated Account profile page, reachable from the avatar menu in the top-right header, the account tile at the bottom of the desktop/tablet navigation drawer, and the mobile More menu.
- Personal display name is editable and updates Firebase Authentication `displayName`, which supplies the personalized greeting and account identity in the header/sidebar.
- Personal phone number is saved to the signed-in owner's existing `users/{uid}` document.
- Sign-in email is displayed separately from business email. Email changes use Firebase Authentication's `verifyBeforeUpdateEmail` verification flow. The current email changes only after the new address is confirmed; Firebase may require a recent sign-in.
- Added a password-reset action for email/password accounts. Linked-provider-only accounts are told to manage credentials through their provider.

### Responsive navigation
- Desktop (1024px and wider): full-width sidebar by default; the header toggle hides/reopens it so the content can use the full viewport.
- Tablet (768–1023px): off-canvas navigation starts closed and opens from the header toggle; items retain labels, icons and native hover titles.
- Mobile (below 768px): floating curved dock, safe-area-aware spacing, and a More menu for secondary destinations.
- Account profile and Business settings are kept as separate destinations.

### Motion, typography and interaction
- Applied Manrope heading typography consistently with subtle title/subtitle/page-entry animations.
- Added native smooth scrolling, button press/lift feedback, card hover elevation and a restrained pointer-follow spotlight/micro-magnetic offset for mouse/pen input.
- Touch devices do not receive pointer-follow effects. `prefers-reduced-motion` disables the animated effects and smooth scrolling.
- No Lenis, Framer Motion or other animation dependency was added.

### Business settings
- Removed the Firebase Storage logo-upload UI and its upload dependencies from Business settings. Existing `logoUrl` values are not deleted; the invoice view can continue rendering an older saved URL for backwards compatibility.
- Kept business name, business phone/email, address, tax PIN and currency in the business workspace settings.
- Added saved alert preferences for low stock, out-of-stock, sales, purchases, payment reminders and a future daily summary.

## Data and security

- The account profile uses the existing self-owned `users/{uid}` document. Current Firestore rules already allow a signed-in user to read/write only their own `/users/{uid}` document; this patch does not require a rules change.
- Personal profile fields: `displayName`, `email`, and `phoneNumber`.
- Business alert preferences: `businessPreferences.notificationPreferences` in the same private user document. The user's business workspace remains keyed by the Auth UID.
- Business settings continue to update only the existing allowed business fields. No changes are made to subscription entitlements, stock, invoices, payments, historical movements or business documents.
- No Cloud Functions, Blaze upgrade or migration is required.

## Notification preference limitation

The alert switches persist user preferences only. The current application does not yet have an in-app notification centre or email/push delivery pipeline for these preference flags. The page states this explicitly; it does not claim that turning a switch on will send an email or push alert.

## QA checklist

1. Save a personal display name and confirm it appears in the greeting, header avatar menu and sidebar account tile after refresh.
2. Save a phone number, reload the app, and confirm it remains in Account profile.
3. Request an email change, confirm the new address using the Firebase link, then use Refresh account details.
4. Send a password reset from an email/password account; confirm linked-provider-only accounts do not show the reset action.
5. Change business identity/currency, reload, and verify the business settings remain separate from the personal profile.
6. Toggle alert preferences, save, reload and verify they persist. Do not expect notification delivery yet.
7. Desktop: verify the sidebar is initially expanded and can be hidden/reopened.
8. Tablet (768–1023px): verify the drawer starts closed and opens from the header control.
9. Mobile (below 768px): verify floating dock, More menu, safe-area spacing and account-profile navigation.
10. Verify dark/light modes, keyboard navigation, focus rings and reduced-motion behaviour.
