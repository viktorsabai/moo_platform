# MOO Owner Operating Model v1

## Product position

The owner area should not be a profile page or a catalog of links. It should be the restaurant's **operating system**: a daily control surface that tells the owner what is happening, what needs a decision, and which action will improve the business. Settings are secondary. The primary experience is operational control.

## Owner jobs-to-be-done

| Owner job | Current support | Required product behavior |
|---|---|---|
| Open the day safely | Partial readiness checks | Morning control card: restaurant status, payment readiness, menu availability, delivery readiness, pending requests and today’s operational queue. |
| Process incoming demand | Orders, leads and subscription inboxes exist separately | One unified inbox with filters by urgency, type and SLA; every item has a next action and status. |
| Keep the guest storefront healthy | Home banners, menu, categories and products are separate | Storefront health: preview, open/closed state, menu availability, top surface content and broken-content alerts in one place. |
| Operate orders | Order list and status controls exist | Queue-first order board: new, in work, ready, completed, blocked; bulk-safe actions and clear exceptions. |
| Grow recurring revenue | Subscription plans, clients and requests are split | Subscription workspace: requests → plan templates → active clients → upcoming deliveries → unit economics. |
| Understand economics | KPI card is useful but shallow | Revenue, AOV, cancellations, repeat/subscription share, contribution by campaign and catering lead conversion with definitions and period comparison. |
| Generate demand | Campaigns, banners and Telegram tools are separate | Campaign workspace: create offer, publish surface, target audience, track redemption and contribution. |
| Convert catering | Lead form and lead list exist | Catering pipeline: new request, qualification, offer, follow-up, won/lost; response SLA and owner next action. |
| Run the team | Team settings exist | Role-aware team workspace with invitation status, permissions and notification routing. |
| Configure the system | Settings are mixed into operational pages | Advanced settings center, grouped by domain, with impact explanation and safe confirmation. |

## Target launch workspace

The first screen should have five layers, in this order:

1. **Control strip.** Restaurant name, open/paused/closed status, current service mode and a single `open guest view` action.
2. **Today command center.** A concise queue of urgent items. The card must answer: what happened, what is blocked, who owns it, and what should I do now?
3. **Business pulse.** Revenue, orders, AOV, cancellation rate, repeat/subscription share and catering pipeline value. Each metric has a comparison period and definition.
4. **Growth opportunities.** No more than three contextual opportunities, generated from real signals: unfinished storefront, inactive subscription offer, campaign with redemptions but low contribution, unanswered catering lead.
5. **Workspaces.** Large entry cards for Operations, Storefront, Subscriptions, Growth, Catering, Analytics and Team. Each card contains a short current-state summary and one primary action. Deep settings are never shown inline by default.

## Workspace hierarchy

| Workspace | Primary screens | Advanced settings moved out |
|---|---|---|
| Operations | Inbox, order queue, delivery/pickup, exceptions | SLA rules, payment edge cases, status automation |
| Storefront | Guest preview, menu, home content, availability | Banner placement, QR, publication rules, image migration |
| Subscriptions | Requests, plans, active clients, delivery calendar, economics | Preset limits, cutoff rules, notification policy |
| Growth | Campaigns, audience, attribution, contribution | Redemption restrictions, campaign technical fields |
| Catering | Pipeline, request detail, response templates, offer status | Lead source mapping, internal routing |
| Analytics | Business pulse, traffic, funnel, campaign contribution | Export definitions, retention windows |
| Team | Members, roles, Telegram routing, notification preferences | Invite expiry, platform-level permissions |
| Settings | Venue, payments, delivery, integrations, audit | Database/technical diagnostics |

## What to remove or change

The following should not remain as first-class launch content: generic profile-style navigation, repeated links to the same resource, technical labels such as `publication settings`, separate isolated counters without an action, empty cards that only say zero, and broad settings panels mixed with daily operations. The owner should see a state and a next step, not a directory of database entities.

The existing KPI economics card should remain as a foundation, but it needs trend comparison, cancellation rate, subscription share and a direct `open analytics` action. The existing readiness card should become the Today command center, not a passive status panel. The current owner copilot should not be the center of the product; it belongs inside decision cards and guided workflows.

## Must-have gaps before calling the owner area production-ready

| Gap | Severity | Required outcome |
|---|---:|---|
| No unified owner inbox across order/subscription/lead work | P0 | One queue with urgency and next action. |
| No storefront health/preview workspace | P0 | Owner can understand exactly what guests see and what is broken. |
| Analytics lacks decision context and comparison | P1 | Every KPI has trend, definition and action. |
| Subscription economics and delivery calendar are fragmented | P1 | One lifecycle workspace from request to recurring delivery. |
| Catering is a lead list rather than a pipeline | P1 | Qualification, follow-up, offer and outcome states. |
| Quick actions and advanced settings remain mixed | P1 | Separate command layer from configuration layer. |
| Notification preferences lack team routing visibility | P1 | Owner sees who receives which operational alert. |
| Empty/error states do not explain business impact | P1 | Every empty or failed state provides a next action and fallback. |
| No role-aware workspace emphasis | P2 | Owner, manager and staff see the actions relevant to them. |
| No cross-domain activity/audit timeline | P2 | Owner can trace what changed, when and by whom. |

## Design principles

The owner area should use large, calm cards, but cards are containers for decisions rather than decoration. Each card has one dominant heading, one current state, one primary action and optional secondary detail. The visual hierarchy is command center → decision → action → detail. The interface should feel like a focused restaurant control room, not a mobile CRM menu.

The next implementation batch should therefore replace the current profile-like dashboard composition with a new launch workspace shell and then migrate domains one by one. It should not attempt another pass of styling the existing list.
