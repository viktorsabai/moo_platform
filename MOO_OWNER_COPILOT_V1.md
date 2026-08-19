# MOO Owner Copilot v1

## What the owner gets

The owner launch workspace now contains a free Copilot card above the operational domain cards. It accepts natural-language prompts and three quick actions:

| Prompt | Result |
|---|---|
| `что сейчас требует внимания?` | Explains the current operational signals from orders, revenue, cancellations, active subscriptions and new leads. |
| `составь мне план подписки` | Produces a non-published draft based on the existing Standard subscription preset, with delivery frequency and dishes-per-delivery constraints. |
| `выгрузи информацию за последнюю неделю` | Provides a CSV download for the last seven days with order id, UTC timestamp, status, payment status, fulfillment method, item count, total and discount. |

## Safety model

The copilot is **read-first**. It does not publish a subscription plan, edit menu prices, send a broadcast or change operational settings. A plan response links to the existing subscription constructor, where the owner reviews and confirms the draft manually. Export data contains no guest name, Telegram handle, address or payment identifier.

The backend uses the existing restaurant admin authorization context. All metrics are scoped to the current restaurant. The rule-based response is always available. If the server has the optional built-in LLM environment configured, it may add a concise explanation on top of the same structured context; it cannot invent additional database facts or perform actions.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/copilot` | Detects advice, subscription-plan or export intent and returns structured result. |
| `GET /api/admin/copilot/export?days=7` | Downloads a scoped order CSV for 1–90 days. |

## Next safe expansion

The next iteration can add an explicit `создать draft` action that writes a draft `SubscriptionPlanTemplate` only after owner confirmation. Telegram can expose the same prompts through owner bot commands and return a Mini App deep-link to the Copilot card or CSV delivery. Any write action must remain two-step: generate → review → confirm.

## Smoke scenarios

Open `/admin` as an owner and verify the Copilot card appears above domain cards. Ask for current attention and confirm the response uses live metrics. Ask for a subscription plan and confirm the result is labelled `черновик` and does not create a plan automatically. Ask for a weekly export and download the CSV; verify the header and absence of PII. Repeat with a staff member who lacks admin permission and confirm the API returns forbidden.
