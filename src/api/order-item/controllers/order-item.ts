// src/api/order-item/server/controllers/order-item.ts
import { factories } from "@strapi/strapi";

/**
 * Default controller for order-item.
 * Uses Strapi factories.createCoreController to keep standard behavior,
 * but it's a great place to add extra validation (stock checks, etc.)
 */
export default factories.createCoreController("api::order-item.order-item");
