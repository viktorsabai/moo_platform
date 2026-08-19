# Moo Platform staging smoke — 2026-08-19

## Preview

The `test` branch head is `61c7e7a2e851836b614bd034d8f0f1e0743d5247`. GitHub reports the Vercel Preview Comments check as completed successfully. The preview URL is https://ufo-delivery-git-test-viktor-s-projects-aae1219d.vercel.app/.

## Read-only entrypoint check

The preview opens successfully and renders the guest shell with navigation to the home page, menu, delivery, subscriptions, and profile. No build/runtime error was visible at the public entrypoint.

## Remaining E2E boundary

The public browser check does not reproduce Telegram `initData` authentication. Guest order, subscription, owner admin, Telegram notification, payment/receipt and realtime refresh scenarios must be executed from the Telegram Mini App using `@topka_demo_bot` and a real Telegram session. No transactional action was performed during this smoke check.

## Telegram launch boundary

The public `https://t.me/topka_demo_bot` page only exposes a Telegram contact link. It does not expose the Mini App launch payload in the browser. Starting the bot or opening the Mini App must happen in the user's Telegram client/session; no Start/message action was performed.
