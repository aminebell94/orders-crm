# Design Document: Order Stock Validation

## Overview

This feature implements stock availability validation for order items in the Strapi application. The validation logic will be integrated into the existing order-item lifecycle hooks to prevent orders from being placed when insufficient inventory is available.

The design leverages Strapi's lifecycle hook system to intercept order item creation and updates before they are persisted to the database. By adding `beforeCreate` and `beforeUpdate` hooks, we can validate stock availability and throw errors when business rules are violated, while maintaining compatibility with the existing `afterCreate`, `afterUpdate`, and `afterDelete` hooks that handle order total recalculation.

## Architecture

### System Components

The feature consists of a single validation module integrated into the existing order-item lifecycle hooks:

```
┌─────────────────────────────────────────────────────────┐
│                    API Request Layer                     │
│              (Strapi REST/GraphQL API)                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Order Item Lifecycle Hooks                  │
│  ┌────────────────────────────────────────────────┐    │
│  │  beforeCreate / beforeUpdate                    │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │  Stock Validation Logic                   │  │    │
│  │  │  - Retrieve product                       │  │    │
│  │  │  - Check stock availability               │  │    │
│  │  │  - Throw error if insufficient            │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────┘    │
│                     │                                    │
│                     ▼                                    │
│  ┌────────────────────────────────────────────────┐    │
│  │  afterCreate / afterUpdate / afterDelete        │    │
│  │  (Existing order total recalculation)           │    │
│  └────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Database Layer                          │
│         (Product & Order Item Collections)               │
└─────────────────────────────────────────────────────────┘
```

### Hook Execution Flow

The lifecycle hooks now handle both validation and stock management in a specific order:

1. **beforeCreate/beforeUpdate**: Stock validation executes first
   - Retrieve product and current stock level
   - For updates: retrieve previous quantity to calculate delta
   - Validate requested quantity against available stock
   - If validation fails: Error is thrown, transaction aborted
   - If validation succeeds: Execution continues to database write

2. **Database Write**: Strapi persists the order item

3. **afterCreate/afterUpdate/afterDelete**: Stock adjustment and order total recalculation
   - **Stock Adjustment Phase**:
     - afterCreate: Decrease stock by requested quantity
     - afterUpdate: Adjust stock by quantity delta (previous - new)
     - afterDelete: Increase stock by deleted quantity
   - **Order Total Recalculation Phase**:
     - Recalculate order total based on all order items
   - If stock adjustment fails: Error is thrown, transaction aborted
   - Only runs if validation succeeded and write completed

This design ensures:
- Invalid order items never reach the database
- Stock adjustments are atomic with order item operations
- Order totals reflect only valid, committed order items
- All operations within a single transaction maintain consistency

## Components and Interfaces

### Stock Validation Function

```typescript
async function validateStockAvailability(
  productId: number,
  requestedQuantity: number
): Promise<void>
```

**Purpose**: Validates that sufficient stock exists for the requested quantity

**Parameters**:
- `productId`: The ID of the product being ordered
- `requestedQuantity`: The quantity requested in the order item

**Behavior**:
- Queries the product repository for the product
- Throws `ApplicationError` if product is not found
- Throws `ApplicationError` if requested quantity exceeds available stock
- Returns successfully if validation passes

**Error Messages**:
- Missing product: `"Product with ID {id} not found"`
- Insufficient stock: `"Insufficient stock for product {id}. Available: {stock}, Requested: {quantity}"`

### Stock Adjustment Functions

```typescript
async function decreaseStock(
  productId: number,
  quantity: number
): Promise<void>
```

**Purpose**: Decreases product stock level by the specified quantity

**Parameters**:
- `productId`: The ID of the product
- `quantity`: The amount to decrease (positive integer)

**Behavior**:
- Updates the product's stock field by subtracting the quantity
- Throws `ApplicationError` if product is not found
- Throws `ApplicationError` if resulting stock would be negative
- Uses atomic database update operation

```typescript
async function increaseStock(
  productId: number,
  quantity: number
): Promise<void>
```

**Purpose**: Increases product stock level by the specified quantity

**Parameters**:
- `productId`: The ID of the product
- `quantity`: The amount to increase (positive integer)

**Behavior**:
- Updates the product's stock field by adding the quantity
- Throws `ApplicationError` if product is not found
- Uses atomic database update operation

```typescript
async function adjustStockByDelta(
  productId: number,
  previousQuantity: number,
  newQuantity: number
): Promise<void>
```

**Purpose**: Adjusts stock based on the difference between old and new quantities

**Parameters**:
- `productId`: The ID of the product
- `previousQuantity`: The original order item quantity
- `newQuantity`: The updated order item quantity

**Behavior**:
- Calculates delta = previousQuantity - newQuantity
- If delta > 0: Increases stock (quantity decreased, stock returned)
- If delta < 0: Decreases stock (quantity increased, stock consumed)
- If delta = 0: No stock adjustment needed
- Throws `ApplicationError` if product is not found
- Uses atomic database update operation

### Lifecycle Hook Integration

The validation and stock adjustment functions will be called from lifecycle hooks:

```typescript
export default {
  async beforeCreate(event) {
    // Extract product ID and quantity from event
    // Call validateStockAvailability
    // Error propagates automatically if validation fails
  },
  
  async beforeUpdate(event) {
    // Extract product ID and new quantity from event
    // Retrieve current order item to get previous quantity
    // Call validateStockAvailability with new quantity
    // Store previous quantity for use in afterUpdate
    // Error propagates automatically if validation fails
  },
  
  async afterCreate(event) {
    // Extract product ID and quantity from created order item
    // Call decreaseStock to consume inventory
    // Then perform order total recalculation
  },
  
  async afterUpdate(event) {
    // Retrieve previous quantity (stored in beforeUpdate)
    // Extract product ID and new quantity from updated order item
    // Call adjustStockByDelta to adjust inventory
    // Then perform order total recalculation
  },
  
  async afterDelete(event) {
    // Extract product ID and quantity from deleted order item
    // Call increaseStock to restore inventory
    // Then perform order total recalculation
  }
}
```

**Operation Order**:
1. Validation (beforeCreate/beforeUpdate)
2. Database write (Strapi internal)
3. Stock adjustment (afterCreate/afterUpdate/afterDelete)
4. Order total recalculation (afterCreate/afterUpdate/afterDelete)

### Strapi Query Interface

The validation and stock adjustment functions will use Strapi's database query API:

**For validation (read-only)**:
```typescript
const product = await strapi.db.query('api::product.product').findOne({
  where: { id: productId },
  select: ['id', 'stock']
});
```

**For stock adjustments (atomic updates)**:
```typescript
// Decrease stock
await strapi.db.query('api::product.product').update({
  where: { id: productId },
  data: {
    stock: product.stock - quantity
  }
});

// Increase stock
await strapi.db.query('api::product.product').update({
  where: { id: productId },
  data: {
    stock: product.stock + quantity
  }
});
```

**For retrieving previous quantity in beforeUpdate**:
```typescript
const currentOrderItem = await strapi.db.query('api::order-item.order-item').findOne({
  where: { id: event.params.where.id },
  select: ['quantity', 'product']
});
```

These queries ensure efficient operations and atomic stock updates within the transaction.

## Data Models

### Product Model (Existing)

```typescript
interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;        // Available inventory
  is_active: boolean;
  order_items: OrderItem[];
}
```

**Relevant Fields**:
- `stock`: Integer representing available inventory (default: 0, required: true)

### Order Item Model (Existing)

```typescript
interface OrderItem {
  id: number;
  order: Order;
  product: Product;
  quantity: number;     // Requested quantity (min: 1, required: true)
  unit_price: number;
}
```

**Relevant Fields**:
- `quantity`: Integer representing requested quantity (minimum value: 1)
- `product`: Relation to Product model

### Event Data Structures

**beforeCreate Event**:
```typescript
{
  params: {
    data: {
      product: number | { id: number },  // Product ID or relation object
      quantity: number,
      // ... other fields
    }
  }
}
```

**beforeUpdate Event**:
```typescript
{
  params: {
    data: {
      product?: number | { id: number },  // May be updated
      quantity?: number,                   // May be updated
      // ... other fields
    },
    where: {
      id: number  // Order item being updated
    }
  }
}
```

For updates, we need to handle cases where only quantity changes, only product changes, or both change. If neither field is being updated, validation can be skipped.


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Stock Validation on Order Item Creation

For any product with a given stock level and any requested quantity, when creating an order item:
- If the requested quantity exceeds the available stock, the system shall throw a validation error
- If the requested quantity is less than or equal to the available stock, the system shall allow the creation to proceed

**Validates: Requirements 1.3, 1.4**

### Property 2: Stock Validation on Order Item Updates

For any existing order item and any new quantity value, when updating the order item quantity:
- If the new quantity exceeds the product's available stock, the system shall throw a validation error
- If the new quantity is less than or equal to the available stock, the system shall allow the update to proceed

**Validates: Requirements 2.3, 2.4**

### Property 3: Error Messages Contain Required Information

For any stock validation failure, the error message shall contain all of the following:
- The product identifier
- The available stock level
- The requested quantity

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 4: Failed Validation Prevents Side Effects

For any order item creation or update that fails stock validation, the order total recalculation shall not execute, and the product stock level shall remain unchanged, ensuring atomicity of the operation.

**Validates: Requirements 5.1, 5.2, 5.3, 9.2**

### Property 5: Successful Validation Preserves Existing Functionality

For any valid order item creation or update (where stock is sufficient), the order total recalculation shall execute normally, and the order's total_price shall reflect the sum of all order item subtotals (quantity × unit_price).

**Validates: Requirements 5.4**

### Property 6: Stock Decreases on Order Item Creation

For any order item creation with a requested quantity Q, after successful validation and creation, the product's stock level shall decrease by exactly Q units.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Stock Adjusts Correctly on Quantity Updates

For any order item quantity update from previous quantity P to new quantity N:
- If N > P, the product's stock level shall decrease by (N - P) units
- If N < P, the product's stock level shall increase by (P - N) units
- If N = P, the product's stock level shall remain unchanged

**Validates: Requirements 7.2, 7.3, 7.4, 7.5, 10.1**

### Property 8: Stock Increases on Order Item Deletion

For any order item deletion with quantity Q, the product's stock level shall increase by exactly Q units, restoring the inventory to available stock.

**Validates: Requirements 8.2, 8.3, 8.4**

### Property 9: Stock Adjustment Atomicity

For any order item operation (create, update, or delete):
- If validation fails, the stock level shall not be modified
- If stock adjustment fails after validation succeeds, the order item operation shall not complete
- Each operation shall result in exactly one corresponding stock adjustment

**Validates: Requirements 6.4, 7.6, 9.1, 9.3, 9.4**

### Property 10: Stock Level Non-Negativity Invariant

For any sequence of order item operations (create, update, delete), the product's stock level shall never become negative at any point during or after the operations.

**Validates: Requirements 10.4**

## Error Handling

### Error Types

The system will use Strapi's `ApplicationError` class for all validation and stock adjustment failures. This error type:
- Returns HTTP 400 (Bad Request) status code
- Includes a descriptive message in the response body
- Prevents the database transaction from committing

### Error Scenarios

1. **Missing Product Reference**
   - Trigger: Order item created/updated without a product ID
   - Error: `ApplicationError("Product reference is required")`
   - HTTP Status: 400

2. **Product Not Found**
   - Trigger: Order item references a non-existent product ID
   - Error: `ApplicationError("Product with ID {id} not found")`
   - HTTP Status: 400

3. **Insufficient Stock (Validation)**
   - Trigger: Requested quantity exceeds available stock
   - Error: `ApplicationError("Insufficient stock for product {id}. Available: {stock}, Requested: {quantity}")`
   - HTTP Status: 400

4. **Stock Adjustment Failure**
   - Trigger: Stock update operation fails after validation succeeds
   - Error: `ApplicationError("Failed to adjust stock for product {id}")`
   - HTTP Status: 400
   - Note: Transaction is rolled back, order item operation does not complete

5. **Negative Stock Prevention**
   - Trigger: Stock adjustment would result in negative stock level
   - Error: `ApplicationError("Stock adjustment would result in negative stock for product {id}")`
   - HTTP Status: 400

6. **Missing Product on Deletion**
   - Trigger: Order item deletion references a product that no longer exists
   - Behavior: Log warning, allow deletion to complete
   - Log Message: `"Warning: Could not restore stock for deleted order item {id}, product {productId} not found"`

### Error Handling Flow

```
API Request
    ↓
beforeCreate/beforeUpdate Hook
    ↓
validateStockAvailability()
    ↓
    ├─ Validation Fails → throw ApplicationError
    │                          ↓
    │                     Transaction Rollback
    │                          ↓
    │                     HTTP 400 Response
    │
    └─ Validation Succeeds → Continue to Database Write
                                  ↓
                             afterCreate/afterUpdate/afterDelete Hook
                                  ↓
                             Stock Adjustment
                                  ↓
                                  ├─ Adjustment Fails → throw ApplicationError
                                  │                          ↓
                                  │                     Transaction Rollback
                                  │                          ↓
                                  │                     HTTP 400 Response
                                  │
                                  └─ Adjustment Succeeds → Order Total Recalculation
                                                               ↓
                                                          HTTP 200 Response
```

### Transaction Safety

Strapi's lifecycle hooks execute within the same database transaction as the main operation. This ensures atomicity for the complete operation:

**On Success**:
1. Validation passes (beforeCreate/beforeUpdate)
2. Order item is written to database
3. Stock is adjusted (afterCreate/afterUpdate/afterDelete)
4. Order total is recalculated
5. Transaction commits
6. All changes are persisted atomically

**On Validation Failure**:
1. Validation fails (beforeCreate/beforeUpdate)
2. Error is thrown
3. Transaction is rolled back
4. No data is persisted (no order item, no stock change, no total update)

**On Stock Adjustment Failure**:
1. Validation passes (beforeCreate/beforeUpdate)
2. Order item is written to database
3. Stock adjustment fails (afterCreate/afterUpdate/afterDelete)
4. Error is thrown
5. Transaction is rolled back
6. No data is persisted (order item write is undone, no stock change, no total update)

This ensures that:
- Order items are only created/updated when stock is available
- Stock adjustments are atomic with order item operations
- Inventory data remains consistent even when errors occur
- No partial updates can occur (either everything succeeds or everything fails)

## Testing Strategy

### Dual Testing Approach

This feature will be validated using both unit tests and property-based tests:

- **Unit Tests**: Verify specific examples, edge cases, and integration points
- **Property Tests**: Verify universal properties across randomized inputs

Together, these approaches provide comprehensive coverage: unit tests catch concrete bugs and validate specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Unit Testing

Unit tests will focus on:

1. **Specific Examples**
   - Creating an order item with quantity = 5 when stock = 10 (should succeed, stock becomes 5)
   - Creating an order item with quantity = 15 when stock = 10 (should fail, stock unchanged)
   - Updating quantity from 5 to 8 when stock = 10 (should succeed, stock decreases by 3)
   - Updating quantity from 5 to 12 when stock = 10 (should fail, stock unchanged)
   - Updating quantity from 8 to 5 when stock = 10 (should succeed, stock increases by 3)
   - Deleting an order item with quantity = 5 (should succeed, stock increases by 5)

2. **Edge Cases**
   - Order item with missing product reference (null/undefined)
   - Order item referencing non-existent product ID
   - Order item with quantity = stock (boundary condition)
   - Order item with quantity = stock + 1 (boundary condition)
   - Updating order item quantity to the same value (stock should not change)
   - Deleting order item when product no longer exists (should log warning but succeed)

3. **Integration Points**
   - Verify stock adjustment runs after validation but before order total recalculation
   - Verify order total recalculation runs after stock adjustment
   - Verify order total remains unchanged after failed validation
   - Verify order item is not created when stock adjustment fails
   - Verify existing afterDelete hook continues to work correctly

4. **Error Message Validation**
   - Verify error messages contain product ID, stock level, and requested quantity
   - Verify error message format is consistent
   - Verify stock adjustment failure messages are clear

5. **Atomicity Tests**
   - Verify failed validation prevents stock changes
   - Verify failed stock adjustment rolls back order item creation
   - Verify failed stock adjustment rolls back order item update
   - Verify stock level never goes negative

### Property-Based Testing

Property-based tests will use **fast-check** (for TypeScript/JavaScript) to generate randomized test inputs and verify universal properties.

Each property test will:
- Run a minimum of 100 iterations with randomized inputs
- Reference the corresponding design document property in a comment tag
- Use the format: `// Feature: order-stock-validation, Property {number}: {property_text}`

**Property Test 1: Stock Validation on Creation**
```typescript
// Feature: order-stock-validation, Property 1: Stock validation on order item creation
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 1000 }), // stock level
    fc.integer({ min: 1, max: 1000 }), // requested quantity
    async (stock, quantity) => {
      // Create product with given stock
      // Attempt to create order item with given quantity
      // Assert: if quantity > stock, expect error; else expect success
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 2: Stock Validation on Update**
```typescript
// Feature: order-stock-validation, Property 2: Stock validation on order item updates
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 1000 }), // stock level
    fc.integer({ min: 1, max: 1000 }), // initial quantity (valid)
    fc.integer({ min: 1, max: 1000 }), // new quantity
    async (stock, initialQty, newQty) => {
      // Create product with given stock
      // Create order item with initialQty (where initialQty <= stock)
      // Attempt to update to newQty
      // Assert: if newQty > stock, expect error; else expect success
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 3: Error Message Content**
```typescript
// Feature: order-stock-validation, Property 3: Error messages contain required information
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 100 }),  // stock level
    fc.integer({ min: 101, max: 200 }), // quantity (always exceeds stock)
    async (stock, quantity) => {
      // Create product with given stock
      // Attempt to create order item with quantity > stock
      // Assert: error message contains product ID, stock value, and quantity value
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 4: Failed Validation Prevents Side Effects**
```typescript
// Feature: order-stock-validation, Property 4: Failed validation prevents side effects
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 100 }),  // stock level
    fc.integer({ min: 101, max: 200 }), // quantity (always exceeds stock)
    async (stock, quantity) => {
      // Create order with initial total_price
      // Create product with given stock (record initial stock)
      // Attempt to create order item with quantity > stock (should fail)
      // Assert: order total_price remains unchanged AND product stock remains unchanged
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 5: Successful Validation Preserves Functionality**
```typescript
// Feature: order-stock-validation, Property 5: Successful validation preserves existing functionality
fc.assert(
  fc.property(
    fc.integer({ min: 100, max: 1000 }), // stock level (high enough)
    fc.integer({ min: 1, max: 50 }),     // quantity (always within stock)
    fc.float({ min: 1, max: 100 }),      // unit price
    async (stock, quantity, unitPrice) => {
      // Create order
      // Create product with given stock
      // Create order item with quantity and unitPrice
      // Assert: order total_price = quantity × unitPrice
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 6: Stock Decreases on Creation**
```typescript
// Feature: order-stock-validation, Property 6: Stock decreases on order item creation
fc.assert(
  fc.property(
    fc.integer({ min: 100, max: 1000 }), // stock level (high enough)
    fc.integer({ min: 1, max: 50 }),     // quantity (always within stock)
    async (initialStock, quantity) => {
      // Create product with initialStock
      // Create order item with quantity
      // Retrieve product and check stock
      // Assert: product.stock = initialStock - quantity
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 7: Stock Adjusts Correctly on Updates**
```typescript
// Feature: order-stock-validation, Property 7: Stock adjusts correctly on quantity updates
fc.assert(
  fc.property(
    fc.integer({ min: 100, max: 1000 }), // stock level (high enough)
    fc.integer({ min: 1, max: 30 }),     // previous quantity
    fc.integer({ min: 1, max: 30 }),     // new quantity
    async (initialStock, prevQty, newQty) => {
      // Create product with initialStock
      // Create order item with prevQty
      // Record stock after creation: stockAfterCreate = initialStock - prevQty
      // Update order item to newQty
      // Retrieve product and check stock
      // Expected: stockAfterCreate + prevQty - newQty
      // Assert: stock adjusted correctly based on delta
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 8: Stock Increases on Deletion**
```typescript
// Feature: order-stock-validation, Property 8: Stock increases on order item deletion
fc.assert(
  fc.property(
    fc.integer({ min: 100, max: 1000 }), // stock level (high enough)
    fc.integer({ min: 1, max: 50 }),     // quantity
    async (initialStock, quantity) => {
      // Create product with initialStock
      // Create order item with quantity
      // Record stock after creation: stockAfterCreate = initialStock - quantity
      // Delete order item
      // Retrieve product and check stock
      // Assert: product.stock = initialStock (restored)
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 9: Stock Adjustment Atomicity**
```typescript
// Feature: order-stock-validation, Property 9: Stock adjustment atomicity
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 100 }),  // stock level
    fc.integer({ min: 101, max: 200 }), // quantity (exceeds stock)
    async (stock, quantity) => {
      // Create product with stock
      // Attempt to create order item with quantity > stock
      // Assert: operation fails AND stock unchanged AND order item not created
      
      // Also test stock adjustment failure scenario:
      // Mock stock update to fail after validation
      // Attempt to create valid order item
      // Assert: operation fails AND order item not created
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 10: Stock Non-Negativity Invariant**
```typescript
// Feature: order-stock-validation, Property 10: Stock level non-negativity invariant
fc.assert(
  fc.property(
    fc.integer({ min: 50, max: 200 }),   // initial stock
    fc.array(
      fc.record({
        operation: fc.constantFrom('create', 'update', 'delete'),
        quantity: fc.integer({ min: 1, max: 20 })
      }),
      { minLength: 5, maxLength: 20 }
    ), // sequence of operations
    async (initialStock, operations) => {
      // Create product with initialStock
      // Execute sequence of operations
      // After each operation, retrieve product and check stock
      // Assert: product.stock >= 0 at all times
      // Note: Some operations may fail validation, which is expected
    }
  ),
  { numRuns: 100 }
);
```

### Test Environment Setup

Tests will require:
- Strapi test instance with in-memory SQLite database
- Test fixtures for creating products, orders, and order items
- Mocking or test doubles for the Strapi query API (if needed for unit tests)
- fast-check library for property-based testing

### Coverage Goals

- 100% coverage of the stock validation function
- 100% coverage of stock adjustment functions (decreaseStock, increaseStock, adjustStockByDelta)
- 100% coverage of all lifecycle hooks (beforeCreate, beforeUpdate, afterCreate, afterUpdate, afterDelete)
- All 10 correctness properties validated by property-based tests
- All edge cases covered by unit tests
- Transaction atomicity verified for all operation types
- Stock non-negativity invariant verified across operation sequences
