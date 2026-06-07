# Firestore Setup

This storefront is already wired for Firestore orders using the Firebase
project in `site-config.js`.

Current site behavior:

- If Firestore is available and your Firebase project is enabled, website
  orders are saved to Firestore.
- If Firestore is unavailable or blocked, the site falls back to browser
  storage automatically so checkout still works.

## Firebase Console Steps

1. Open Firebase Console for `antarmana-sweets-and-snacks`.
2. Create or open **Firestore Database**.
3. Create a collection named `orders`.
4. Keep the Firebase web config in `site-config.js` as-is unless your project
   settings change.

## Important Note

This repo currently keeps the owner dashboard passcode in the browser. That is
not strong security. Firestore setup gives you a shared database, but it does
not turn the static dashboard into secure server-side auth.

If you want strong owner-only access later, the next upgrade should be:

- Firebase Authentication for owner login, or
- a backend API with protected owner routes.
