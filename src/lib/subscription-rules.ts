/**
 * Subscription edit rules and UX flow states.
 * Cutoff = 12 hours before delivery. After cutoff, changes apply only to future deliveries.
 */

// ─── Edit rules ─────────────────────────────────────────────────────────────

const CUTOFF_HOURS = 12
const CUTOFF_MS = CUTOFF_HOURS * 60 * 60 * 1000

/** Subscription-like shape for canEditSubscription. */
export interface SubscriptionForEdit {
  status: string
  nextDelivery?: Date | string | null
}

/** Delivery-like shape for canEditDelivery. */
export interface DeliveryForEdit {
  scheduledDate: Date | string
  status?: string
  deliveredAt?: Date | string | null
}

/**
 * Whether the subscription can be edited.
 * - DRAFT: always editable
 * - ACTIVE, PAUSED: editable only before cutoff (12h before next delivery)
 * - CANCELLED, EXPIRED: not editable
 */
export function canEditSubscription(subscription: SubscriptionForEdit, now: Date = new Date()): boolean {
  const status = String(subscription?.status ?? '').toUpperCase()
  const nextDelivery = subscription?.nextDelivery

  if (status === 'DRAFT') return true
  if (status === 'CANCELLED' || status === 'EXPIRED') return false

  // ACTIVE, PAUSED: editable only before cutoff
  if (!nextDelivery) return false
  const next = nextDelivery instanceof Date ? nextDelivery : new Date(nextDelivery)
  const cutoff = new Date(next.getTime() - CUTOFF_MS)
  return now < cutoff
}

/**
 * Whether a specific delivery can be edited.
 * Editable if: status is SCHEDULED or CONFIRMED, and now is before cutoff (12h before scheduledDate).
 */
export function canEditDelivery(delivery: DeliveryForEdit, now: Date = new Date()): boolean {
  const status = String(delivery?.status ?? 'SCHEDULED').toUpperCase()
  const scheduledDate = delivery?.scheduledDate

  if (!scheduledDate) return false
  if (status === 'DELIVERED' || status === 'SKIPPED' || status === 'CANCELLED') return false

  const scheduled = scheduledDate instanceof Date ? scheduledDate : new Date(scheduledDate)
  const cutoff = new Date(scheduled.getTime() - CUTOFF_MS)
  return now < cutoff
}

/**
 * Get cutoff date for a delivery (12h before scheduled).
 */
export function getDeliveryCutoff(scheduledDate: Date | string): Date {
  const scheduled = scheduledDate instanceof Date ? scheduledDate : new Date(scheduledDate)
  return new Date(scheduled.getTime() - CUTOFF_MS)
}

/**
 * Whether changes to the subscription would apply to the next delivery.
 * True if before cutoff; false if after cutoff (changes apply only to future deliveries).
 */
export function changesApplyToNextDelivery(subscription: SubscriptionForEdit, now: Date = new Date()): boolean {
  return canEditSubscription(subscription, now)
}

// ─── UX flow states ─────────────────────────────────────────────────────────

/** Wizard steps. Step 3 is prefilled; user never sees empty state. */
export enum SubscriptionWizardStep {
  SelectPlan = 'SelectPlan',
  SelectDays = 'SelectDays',
  AdjustDishesWithinLimits = 'AdjustDishesWithinLimits',
  ReviewAndConfirm = 'ReviewAndConfirm',
}

/** Ordered steps for new subscription flow. */
export const WIZARD_STEPS_ORDER: SubscriptionWizardStep[] = [
  SubscriptionWizardStep.SelectPlan,
  SubscriptionWizardStep.SelectDays,
  SubscriptionWizardStep.AdjustDishesWithinLimits,
  SubscriptionWizardStep.ReviewAndConfirm,
]

/** Next step in flow. Returns null if at end. */
export function getNextStep(current: SubscriptionWizardStep): SubscriptionWizardStep | null {
  const idx = WIZARD_STEPS_ORDER.indexOf(current)
  if (idx < 0 || idx >= WIZARD_STEPS_ORDER.length - 1) return null
  return WIZARD_STEPS_ORDER[idx + 1]
}

/** Previous step. Returns null if at start. */
export function getPrevStep(current: SubscriptionWizardStep): SubscriptionWizardStep | null {
  const idx = WIZARD_STEPS_ORDER.indexOf(current)
  if (idx <= 0) return null
  return WIZARD_STEPS_ORDER[idx - 1]
}

/** Step index (0-based). */
export function getStepIndex(step: SubscriptionWizardStep): number {
  return WIZARD_STEPS_ORDER.indexOf(step)
}

/** State machine input. */
export type WizardInput =
  | { type: 'SELECT_PLAN'; planId: string }
  | { type: 'SELECT_DAYS'; days: number[] }
  | { type: 'ADJUST_DISHES'; items: { dishId: string; quantity: number }[] }
  | { type: 'CONFIRM' }
  | { type: 'BACK' }
  | { type: 'RESET' }

/** Minimal wizard state for the flow. */
export interface WizardState {
  step: SubscriptionWizardStep
  planId: string | null
  days: number[]
  items: { dishId: string; quantity: number }[]
}

/**
 * Validates that Step 3 has prefilled items (invariant: user never sees empty state).
 */
export function canEnterAdjustDishes(items: { dishId: string; quantity: number }[]): boolean {
  return Array.isArray(items) && items.length > 0 && items.every((i) => i.dishId && i.quantity > 0)
}

/**
 * Simple state machine for the wizard.
 * - Step 1: SelectPlan → planId required to proceed
 * - Step 2: SelectDays → days required (within plan limits)
 * - Step 3: AdjustDishesWithinLimits → MUST start with prefilled items (use canEnterAdjustDishes)
 * - Step 4: ReviewAndConfirm → user confirms
 */
export function wizardReducer(state: WizardState, input: WizardInput): WizardState {
  switch (input.type) {
    case 'RESET':
      return {
        step: SubscriptionWizardStep.SelectPlan,
        planId: null,
        days: [],
        items: [],
      }

    case 'SELECT_PLAN':
      return {
        ...state,
        step: SubscriptionWizardStep.SelectDays,
        planId: input.planId,
      }

    case 'SELECT_DAYS':
      return {
        ...state,
        step: SubscriptionWizardStep.AdjustDishesWithinLimits,
        days: input.days,
        // Items must be prefilled by caller before transitioning (business logic)
        items: state.items,
      }

    case 'ADJUST_DISHES':
      return {
        ...state,
        step: SubscriptionWizardStep.ReviewAndConfirm,
        items: input.items,
      }

    case 'CONFIRM':
      return state

    case 'BACK': {
      const prev = getPrevStep(state.step)
      if (!prev) return state
      return { ...state, step: prev }
    }

    default:
      return state
  }
}
