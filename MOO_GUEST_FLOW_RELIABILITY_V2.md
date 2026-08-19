# MOO Guest Flow Reliability v2

## Order creation

Order creation now returns stable error codes instead of hiding every server failure behind one generic 500. `ADDRESS_INVALID` directs the guest to check address/city, `DATA_CHANGED` asks to refresh the menu/cart, and `ORDER_CREATE_FAILED` explicitly confirms that the cart is preserved and the guest can retry. The checkout client maps these codes into recovery copy and keeps the current cart.

## Subscription builder guidance

The owner subscription builder now exposes a four-step setup indicator:

| Step | Meaning |
|---|---|
| 1 | Choose a preset or enter the plan basis. |
| 2 | Set a price. |
| 3 | Verify delivery days, dishes per delivery and categories. |
| 4 | Create the plan. |

The UI always shows the next incomplete step. The advanced rules block is renamed to explain what it controls: days, dishes and categories. Existing preset application, copy, delete and creation behavior is preserved.

## Subscription request notifications

The request is persisted first. Telegram delivery is then awaited and its result is returned explicitly with `sentCount` and `failedCount`. Missing bot token, missing owner recipients and failed Telegram sends have separate warnings. The guest no longer sees an unconditional success toast when the request was saved but the owner notification was not delivered. The owner can still find the request in the LК inbox.

## Smoke scenarios

Create an order with an invalid/stale address and verify that the cart remains and the message tells the guest what to fix. Change menu data after opening checkout and verify the stale-cart message. In the owner subscription builder, apply a preset and follow the four steps; change days/categories in the advanced block and verify the next-step hint updates. Submit a guest subscription request with a connected owner Telegram account and verify both the guest acknowledgement and owner message. Repeat with Telegram delivery unavailable and verify the request is saved with a precise warning and remains visible in the owner inbox.
