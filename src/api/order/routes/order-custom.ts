export default {
  routes: [
    {
      method: 'POST',
      path: '/orders/place',
      handler: 'order.place',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/orders/:id/replace',
      handler: 'order.replace',
      config: { policies: [] },
    },
    // Optional: edit by documentId if you prefer
    {
      method: 'PUT',
      path: '/orders/by-document/:documentId/replace',
      handler: 'order.replaceByDocumentId',
      config: { policies: [] },
    },
  ],
};
