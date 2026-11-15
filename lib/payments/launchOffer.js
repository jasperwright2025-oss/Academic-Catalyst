import { PRODUCTS } from "./catalog.js";

/**
 * Launch offer (approved by Simon, 15 Nov 2026): half price on the first single purchase
 * for the first 10 paying customers.
 *  - Applies to single purchases ("one_off") only, not monthly plans.
 *  - A customer qualifies once: only if they have no successful payment yet.
 *  - Places are counted as distinct customers with at least one successful payment.
 *  - The discounted price is stored on the transaction, so every payment check
 *    (mobile money review, USDT matching, Pesapal) compares against what was charged.
 * Set ACTIVE to false to end the offer early.
 */
export const LAUNCH_OFFER = {
  ACTIVE: true,
  PLACES: 10,
  DISCOUNT: 0.5,
};

function halve(amount) {
  return Math.round(amount * (1 - LAUNCH_OFFER.DISCOUNT) * 100) / 100;
}

// How many places are taken and whether this user can still use the offer.
export async function launchOfferState(admin, userId = null) {
  if (!LAUNCH_OFFER.ACTIVE) return { active: false, placesLeft: 0, eligible: false };
  const { data, error } = await admin.from("transactions").select("user_id").eq("status", "successful");
  if (error) throw error;
  const payers = new Set((data || []).map((r) => r.user_id));
  const placesLeft = Math.max(0, LAUNCH_OFFER.PLACES - payers.size);
  const eligible = placesLeft > 0 && (userId ? !payers.has(userId) : true);
  return { active: placesLeft > 0, placesLeft, eligible };
}

// Price in USD to charge this user for this product. Falls back to the full price on any error.
export async function chargeUsd(admin, userId, productKey) {
  const product = PRODUCTS[productKey];
  if (!product) return { amount: null, offer: false };
  if (product.type !== "one_off" || !LAUNCH_OFFER.ACTIVE) return { amount: product.amount, offer: false };
  try {
    const state = await launchOfferState(admin, userId);
    if (state.eligible) return { amount: halve(product.amount), offer: true };
  } catch (err) {
    console.error("Launch offer check failed; charging full price:", err);
  }
  return { amount: product.amount, offer: false };
}

export const launchPrice = halve;
