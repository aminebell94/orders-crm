import { factories } from '@strapi/strapi';

type Line = { product: number; quantity: number; unit_price?: number };

function pickBaseOrder(payload: any) {
    console.log('pickBaseOrder', payload);
    return {
        customer_name: payload?.data?.customer_name,
        customer_phone: payload?.data?.customer_phone,
        address: payload?.data?.address,
        orderStatus: payload?.data?.orderStatus, // your renamed field
    };
}

async function findProductPrices(strapi, trx: any, ids: number[]) {
    if (ids.length === 0) return new Map<number, number>();
    const rows = await strapi.db
        .query('api::product.product')
        .findMany({
            where: { id: { $in: ids } },
            select: ['id', 'price'],
        },
        // @ts-ignore
        { transacting: trx });

    const m = new Map<number, number>();
    for (const r of rows) m.set(Number(r.id), Number(r.price));
    return m;
}

async function loadPopulatedOrder(strapi, trx: any, where: any) {
    return strapi.db
        .query('api::order.order')
        .findOne({
            where,
            populate: { items: { populate: ['product'] } },
        },
        // @ts-ignore
        { transacting: trx });
}

export default factories.createCoreController('api::order.order', ({ strapi }) => ({

    /**
     * POST /orders/place
     * Body: { customer_..., orderStatus?, lines: [{ product, quantity }] }
     */
    async place(ctx) {
        const payload = ctx.request.body ?? {};
        const base = pickBaseOrder(payload);
        const lines: Line[] = Array.isArray(payload?.lines) ? payload.lines : [];

        if (!base.customer_name) {
            return ctx.badRequest('customer_name is required');
        }

        const result = await strapi.db.transaction(async ({ trx }) => {
            // 1) Create order
            const orderRepo = strapi.db.query('api::order.order');
            const itemRepo = strapi.db.query('api::order-item.order-item');

            const created = await orderRepo.create({ data: { ...base, total_price: 0 } },
                // @ts-ignore
                { transacting: trx });
            const orderId = created.id as number;

            // 2) Fetch prices for given products
            const productIds = [...new Set(lines.map(l => Number(l.product)).filter(Boolean))];
            const priceMap = await findProductPrices(strapi, trx, productIds);

            // 3) Insert items (use product price as unit_price)
            let total = 0;
            for (const l of lines) {
                const pid = Number(l.product);
                const qty = Number(l.quantity || 0);
                if (!pid || qty <= 0) continue;

                const unit = l.unit_price !== undefined ? Number(l.unit_price) : Number(priceMap.get(pid) ?? 0);

                await itemRepo.create({
                    data: {
                        order: orderId,
                        product: pid,
                        quantity: qty,
                        unit_price: unit,
                    },
                },
                    // @ts-ignore
                    { transacting: trx });

                total += qty * unit;
            }

            // 4) Update total
            await orderRepo.update({
                where: { id: orderId },
                data: { total_price: total },
            },
                // @ts-ignore
                { transacting: trx }
            );

            // 5) Return populated order
            const full = await loadPopulatedOrder(strapi, trx, { id: orderId });
            return full;
        });

        ctx.body = result;
    },

    /**
     * PUT /orders/:id/replace
     * Body: { customer_..., orderStatus?, lines: [{ product, quantity, unit_price? }] }
     * Completely replaces items and updates basics.
     */
    async replace(ctx) {
        const id = Number(ctx.params.id);
        if (!Number.isFinite(id)) return ctx.notFound('Invalid id');

        const payload = ctx.request.body ?? {};
        const base = pickBaseOrder(payload);
        const lines: Line[] = Array.isArray(payload?.lines) ? payload.lines : [];

        const result = await strapi.db.transaction(async ({ trx }) => {
            const orderRepo = strapi.db.query('api::order.order');
            const itemRepo = strapi.db.query('api::order-item.order-item');

            // 1) Ensure order exists
            const exists = await orderRepo.findOne({ where: { id } },
                // @ts-ignore
                { transacting: trx });

            if (!exists) return null;

            // 2) Update base fields
            await orderRepo.update({ where: { id }, data: base },
                // @ts-ignore
                { transacting: trx });

            // 3) Delete current items quickly (raw knex for deleteMany)
            await itemRepo.deleteMany(
                { where: { order: id } },                // use the relation field name
                // @ts-ignore
                { transacting: trx },
            );

            // 4) Fetch prices and recreate
            const productIds = [...new Set(lines.map(l => Number(l.product)).filter(Boolean))];
            const priceMap = await findProductPrices(strapi, trx, productIds);

            let total = 0;
            for (const l of lines) {
                const pid = Number(l.product);
                const qty = Number(l.quantity || 0);
                if (!pid || qty <= 0) continue;

                const unit = l.unit_price !== undefined ? Number(l.unit_price) : Number(priceMap.get(pid) ?? 0);

                await itemRepo.create({
                    data: {
                        order: id,
                        product: pid,
                        quantity: qty,
                        unit_price: unit,
                    },
                },
                    // @ts-ignore
                    { transacting: trx });
                total += qty * unit;
            }

            // 5) Update total
            await orderRepo.update({ where: { id }, data: { total_price: total } },
                // @ts-ignore
                { transacting: trx });

            // 6) Return populated
            const full = await loadPopulatedOrder(strapi, trx, { id });
            return full;
        });

        if (!result) return ctx.notFound();
        ctx.body = result;
    },

    /**
     * PUT /orders/by-document/:documentId/replace
     * Same as replace, but targets the order by documentId.
     */
    async replaceByDocumentId(ctx) {
        const documentId = String(ctx.params.documentId);
        const payload = ctx.request.body ?? {};
        const base = pickBaseOrder(payload);
        console.log('replaceByDocumentId', { documentId, base });
        const lines: Line[] = Array.isArray(payload?.lines) ? payload.lines : [];

        const result = await strapi.db.transaction(async ({ trx }) => {
            const orderRepo = strapi.db.query('api::order.order');
            const row = await orderRepo.findOne({
                where: { documentId: { $eq: documentId } },
                select: ['id', 'documentId'],
            });
            if (!row) return null;

            const id = Number(row.id);

            // reuse the logic above
            const itemRepo = strapi.db.query('api::order-item.order-item');

            await orderRepo.update({ where: { id }, data: base },
                // @ts-ignore
                { transacting: trx });

            await itemRepo.deleteMany(
                { where: { order: id } },                // use the relation field name
                // @ts-ignore
                { transacting: trx },
            );
            const productIds = [...new Set(lines.map(l => Number(l.product)).filter(Boolean))];
            const priceMap = await findProductPrices(strapi, trx, productIds);

            let total = 0;
            for (const l of lines) {
                const pid = Number(l.product);
                const qty = Number(l.quantity || 0);
                if (!pid || qty <= 0) continue;

                const unit = l.unit_price !== undefined ? Number(l.unit_price) : Number(priceMap.get(pid) ?? 0);

                await itemRepo.create({
                    data: { order: id, product: pid, quantity: qty, unit_price: unit },
                },
                    // @ts-ignore
                    { transacting: trx });
                total += qty * unit;
            }

            await orderRepo.update({ where: { id }, data: { total_price: total } },
                // @ts-ignore
                { transacting: trx });
            const full = await loadPopulatedOrder(strapi, trx, { id });
            return full;
        });

        if (!result) return ctx.notFound();
        ctx.body = result;
    },

}));
