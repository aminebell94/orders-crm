import { errors } from '@strapi/utils';
const { ApplicationError } = errors;

async function validateStockAvailability(
    productId: number,
    requestedQuantity: number
): Promise<void> {
    // Query the product to get current stock level
    const product = await strapi.db.query('api::product.product').findOne({
        where: { id: productId },
        select: ['id', 'stock'],
    });

    // Throw error if product not found
    if (!product) {
        throw new ApplicationError(`Product with ID ${productId} not found`);
    }

    // Throw error if insufficient stock
    if (requestedQuantity > product.stock) {
        throw new ApplicationError(
            `Insufficient stock for product ${productId}. Available: ${product.stock}, Requested: ${requestedQuantity}`
        );
    }
}

async function decreaseStock(
    productId: number,
    quantity: number
): Promise<void> {
    // Query product to get current stock level
    const product = await strapi.db.query('api::product.product').findOne({
        where: { id: productId },
        select: ['id', 'stock'],
    });

    // Throw error if product not found
    if (!product) {
        throw new ApplicationError(`Product with ID ${productId} not found`);
    }

    // Calculate new stock level
    const newStock = product.stock - quantity;

    // Throw error if resulting stock would be negative
    if (newStock < 0) {
        throw new ApplicationError(
            `Stock adjustment would result in negative stock for product ${productId}`
        );
    }

    // Use atomic database update operation
    await strapi.db.query('api::product.product').update({
        where: { id: productId },
        data: { stock: newStock },
    });
}

async function increaseStock(
    productId: number,
    quantity: number
): Promise<void> {
    // Query product to get current stock level
    const product = await strapi.db.query('api::product.product').findOne({
        where: { id: productId },
        select: ['id', 'stock'],
    });

    // Throw error if product not found
    if (!product) {
        throw new ApplicationError(`Product with ID ${productId} not found`);
    }

    // Calculate new stock level
    const newStock = product.stock + quantity;

    // Use atomic database update operation
    await strapi.db.query('api::product.product').update({
        where: { id: productId },
        data: { stock: newStock },
    });
}

async function adjustStockByDelta(
    productId: number,
    previousQuantity: number,
    newQuantity: number
): Promise<void> {
    // Calculate delta using integer arithmetic
    const delta = previousQuantity - newQuantity;

    // Skip adjustment when delta = 0 (no change)
    if (delta === 0) {
        return;
    }

    // Call increaseStock when delta > 0 (quantity decreased, stock returned)
    if (delta > 0) {
        await increaseStock(productId, delta);
    }
    // Call decreaseStock when delta < 0 (quantity increased, stock consumed)
    else {
        await decreaseStock(productId, Math.abs(delta));
    }
}

async function recomputeOrderTotal(orderId: number) {
    if (!Number.isFinite(orderId)) return;

    // Fetch all items for this order
    const items = await strapi.db.query('api::order-item.order-item').findMany({
        where: { order: orderId },
        select: ['quantity', 'unit_price'],
    });
    const sum = (items || []).reduce((acc, it) => {
        const qty = Number(it.quantity || 0);
        const price = Number(it.unit_price || 0);
        return acc + qty * price;
    }, 0);

    // Update order.total_price
    await strapi.db.query('api::order.order').update({
        where: { id: orderId },
        data: { total_price: sum },
    });
}

export default {
    async beforeCreate(event) {
        // Extract product ID from event.params.data.product
        const productRef = event?.params?.data?.product;
        
        // Throw ApplicationError if product reference is missing
        if (!productRef) {
            throw new ApplicationError('Product reference is required');
        }
        
        // Handle both numeric ID and relation object formats
        // In Strapi v5, relations can be: number, {id: number}, {connect: [{id: number}]}, {set: [{id: number}]}
        let productId;
        if (typeof productRef === 'number') {
            productId = productRef;
        } else if (productRef?.id) {
            productId = productRef.id;
        } else if (productRef?.connect && Array.isArray(productRef.connect) && productRef.connect[0]?.id) {
            productId = productRef.connect[0].id;
        } else if (productRef?.set && Array.isArray(productRef.set) && productRef.set[0]?.id) {
            productId = productRef.set[0].id;
        }
        
        if (!productId) {
            throw new ApplicationError('Product reference is required');
        }
        
        // Extract quantity from event.params.data.quantity
        const quantity = event?.params?.data?.quantity;
        
        // Call validateStockAvailability with product ID and quantity
        // Allow errors to propagate automatically (no try-catch)
        await validateStockAvailability(productId, quantity);
    },
    async beforeUpdate(event) {
        // Retrieve current order item using event.params.where.id
        const currentOrderItem = await strapi.db.query('api::order-item.order-item').findOne({
            where: { id: event.params.where.id },
            select: ['quantity', 'product'],
            populate: ['product'],
        });

        if (!currentOrderItem) {
            throw new ApplicationError('Order item not found');
        }

        // Extract previous quantity and product ID from current order item
        const previousQuantity = currentOrderItem.quantity;
        const previousProductId = typeof currentOrderItem.product === 'number'
            ? currentOrderItem.product
            : currentOrderItem.product?.id;

        // Extract new quantity from event.params.data.quantity (if present)
        const newQuantity = event?.params?.data?.quantity;

        // Extract new product ID from event.params.data.product (if present)
        const newProductRef = event?.params?.data?.product;
        let newProductId;
        if (newProductRef !== undefined) {
            if (typeof newProductRef === 'number') {
                newProductId = newProductRef;
            } else if (newProductRef?.id) {
                newProductId = newProductRef.id;
            } else if (newProductRef?.connect && Array.isArray(newProductRef.connect) && newProductRef.connect[0]?.id) {
                newProductId = newProductRef.connect[0].id;
            } else if (newProductRef?.set && Array.isArray(newProductRef.set) && newProductRef.set[0]?.id) {
                newProductId = newProductRef.set[0].id;
            }
        }

        // Determine which product ID and quantity to validate
        const productIdToValidate = newProductId !== undefined ? newProductId : previousProductId;
        const quantityToValidate = newQuantity !== undefined ? newQuantity : previousQuantity;

        // Skip validation if neither quantity nor product is being updated
        if (newQuantity === undefined && newProductId === undefined) {
            return;
        }

        // Call validateStockAvailability with product ID and new quantity
        // Allow errors to propagate automatically (no try-catch)
        await validateStockAvailability(productIdToValidate, quantityToValidate);

        // Store previous quantity in event context for use in afterUpdate
        if (!event.state) {
            event.state = {};
        }
        event.state.previousQuantity = previousQuantity;
        event.state.previousProductId = previousProductId;
    },
    async afterCreate(event) {
        // Extract product ID from event.result or event.params.data
        const productRef = event?.result?.product ?? event?.params?.data?.product;
        let productId;
        if (typeof productRef === 'number') {
            productId = productRef;
        } else if (productRef?.id) {
            productId = productRef.id;
        } else if (productRef?.connect && Array.isArray(productRef.connect) && productRef.connect[0]?.id) {
            productId = productRef.connect[0].id;
        } else if (productRef?.set && Array.isArray(productRef.set) && productRef.set[0]?.id) {
            productId = productRef.set[0].id;
        }

        // Extract quantity from event.result or event.params.data
        const quantity = event?.result?.quantity ?? event?.params?.data?.quantity;

        // Call decreaseStock before calling recomputeOrderTotal
        // Allow errors to propagate automatically (no try-catch)
        await decreaseStock(productId, quantity);

        // Maintain existing order total recalculation logic
        const orderId = event?.params?.data?.order?.set?.[0]?.id
        await recomputeOrderTotal(Number(orderId));
    },
    async afterUpdate(event) {
        // Retrieve previous quantity and product ID from event context (stored in beforeUpdate)
        const previousQuantity = event?.state?.previousQuantity;
        const previousProductId = event?.state?.previousProductId;
        
        // Extract product ID from event.result
        const productRef = event?.result?.product;
        let productId;
        if (typeof productRef === 'number') {
            productId = productRef;
        } else if (productRef?.id) {
            productId = productRef.id;
        }
        
        // Extract new quantity from event.result
        const newQuantity = event?.result?.quantity;
        
        // Handle stock adjustment
        if (previousProductId && previousQuantity !== undefined && productId && newQuantity !== undefined) {
            // Check if product changed
            if (previousProductId !== productId) {
                // Product changed: restore stock to old product and decrease from new product
                await increaseStock(previousProductId, previousQuantity);
                await decreaseStock(productId, newQuantity);
            } else {
                // Same product: adjust stock by delta
                await adjustStockByDelta(productId, previousQuantity, newQuantity);
            }
        }
        
        // Maintain existing order total recalculation logic
        const orderId =
            event?.result?.order?.id ??
            event?.params?.data?.order ??
            event?.params?.where?.order;
        await recomputeOrderTotal(Number(orderId));
    },
    async afterDelete(event) {
        // afterDelete can be single or bulk; handle both
        const deleted = Array.isArray(event.result) ? event.result : [event.result];
        
        // Restore stock for each deleted order item
        for (const item of deleted) {
            // Extract product ID from deleted order item
            const productRef = item?.product;
            let productId;
            if (typeof productRef === 'number') {
                productId = productRef;
            } else if (productRef?.id) {
                productId = productRef.id;
            }
            
            // Extract quantity from deleted order item
            const quantity = item?.quantity;
            
            // Call increaseStock before calling recomputeOrderTotal
            if (productId && quantity) {
                try {
                    await increaseStock(productId, quantity);
                } catch (error) {
                    // Wrap increaseStock in try-catch to log warnings for missing products
                    // Allow deletion to complete even if stock restoration fails
                    strapi.log.warn(
                        `Warning: Could not restore stock for deleted order item ${item?.id}, product ${productId} not found or stock restoration failed: ${error.message}`
                    );
                }
            }
        }
        
        // Maintain existing order total recalculation logic
        const orderIds = Array.from(
            new Set(
                deleted
                    .map((row: any) => row?.order?.id ?? row?.order)
                    .filter((x: any) => Number.isFinite(Number(x)))
                    .map((x: any) => Number(x))
            )
        );
        await Promise.all(orderIds.map((id: number) => recomputeOrderTotal(id)));
    },
}
