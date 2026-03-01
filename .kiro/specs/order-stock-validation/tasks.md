# Implementation Plan: Order Stock Validation

## Overview

This implementation adds stock availability validation and automatic stock adjustment to the order-item lifecycle hooks. The feature validates stock levels before order items are created or updated, and automatically adjusts product stock levels when order items are created, updated, or deleted. All operations maintain atomicity within Strapi's transaction system.

## Tasks

- [x] 1. Implement stock validation functions
  - [x] 1.1 Create validateStockAvailability function
    - Implement async function that queries product by ID
    - Add validation logic to check requested quantity against available stock
    - Throw ApplicationError with descriptive message for missing products
    - Throw ApplicationError with descriptive message for insufficient stock
    - Include product ID, available stock, and requested quantity in error messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 1.2 Write property test for stock validation on creation
    - **Property 1: Stock validation on order item creation**
    - **Validates: Requirements 1.3, 1.4**
  
  - [ ]* 1.3 Write property test for stock validation on updates
    - **Property 2: Stock validation on order item updates**
    - **Validates: Requirements 2.3, 2.4**
  
  - [ ]* 1.4 Write property test for error message content
    - **Property 3: Error messages contain required information**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  
  - [ ]* 1.5 Write unit tests for validation edge cases
    - Test missing product reference (null/undefined)
    - Test non-existent product ID
    - Test quantity equals stock (boundary)
    - Test quantity equals stock + 1 (boundary)
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Implement stock adjustment functions
  - [x] 2.1 Create decreaseStock function
    - Implement async function that updates product stock by subtracting quantity
    - Query product to get current stock level
    - Throw ApplicationError if product not found
    - Throw ApplicationError if resulting stock would be negative
    - Use atomic database update operation
    - _Requirements: 6.1, 6.2, 10.4_
  
  - [x] 2.2 Create increaseStock function
    - Implement async function that updates product stock by adding quantity
    - Query product to get current stock level
    - Throw ApplicationError if product not found
    - Use atomic database update operation
    - _Requirements: 8.2, 8.3_
  
  - [x] 2.3 Create adjustStockByDelta function
    - Implement async function that calculates delta between previous and new quantities
    - Call increaseStock when delta > 0 (quantity decreased)
    - Call decreaseStock when delta < 0 (quantity increased)
    - Skip adjustment when delta = 0 (no change)
    - Use integer arithmetic to prevent rounding errors
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 10.1, 10.3_
  
  - [ ]* 2.4 Write property test for stock decrease on creation
    - **Property 6: Stock decreases on order item creation**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  
  - [ ]* 2.5 Write property test for stock adjustment on updates
    - **Property 7: Stock adjusts correctly on quantity updates**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 10.1**
  
  - [ ]* 2.6 Write property test for stock increase on deletion
    - **Property 8: Stock increases on order item deletion**
    - **Validates: Requirements 8.2, 8.3, 8.4**
  
  - [ ]* 2.7 Write unit tests for stock adjustment edge cases
    - Test stock adjustment with quantity = 0
    - Test stock adjustment preventing negative stock
    - Test stock adjustment with missing product on deletion (should log warning)
    - _Requirements: 8.5, 10.2, 10.4_

- [x] 3. Checkpoint - Ensure validation and adjustment functions work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement beforeCreate hook for validation
  - [x] 4.1 Add beforeCreate hook to lifecycles.ts
    - Extract product ID from event.params.data.product
    - Handle both numeric ID and relation object formats
    - Extract quantity from event.params.data.quantity
    - Throw ApplicationError if product reference is missing
    - Call validateStockAvailability with product ID and quantity
    - Allow errors to propagate automatically (no try-catch)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 5.1_
  
  - [ ]* 4.2 Write unit tests for beforeCreate hook
    - Test successful creation with sufficient stock
    - Test failed creation with insufficient stock
    - Test creation with missing product reference
    - Test creation with non-existent product
    - _Requirements: 1.3, 1.4, 3.1, 3.2_
  
  - [ ]* 4.3 Write property test for failed validation preventing side effects
    - **Property 4: Failed validation prevents side effects**
    - **Validates: Requirements 5.1, 5.2, 5.3, 9.2**

- [x] 5. Implement beforeUpdate hook for validation
  - [x] 5.1 Add beforeUpdate hook to lifecycles.ts
    - Retrieve current order item using event.params.where.id
    - Extract previous quantity and product ID from current order item
    - Extract new quantity from event.params.data.quantity (if present)
    - Extract new product ID from event.params.data.product (if present)
    - Skip validation if neither quantity nor product is being updated
    - Call validateStockAvailability with product ID and new quantity
    - Store previous quantity in event context for use in afterUpdate
    - Allow errors to propagate automatically (no try-catch)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.2, 7.1_
  
  - [ ]* 5.2 Write unit tests for beforeUpdate hook
    - Test successful update with sufficient stock
    - Test failed update with insufficient stock
    - Test update with no quantity or product change (should skip validation)
    - Test update changing both quantity and product
    - _Requirements: 2.3, 2.4, 10.1_

- [x] 6. Checkpoint - Ensure validation hooks work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update afterCreate hook for stock adjustment
  - [x] 7.1 Modify existing afterCreate hook
    - Extract product ID from event.result or event.params.data
    - Extract quantity from event.result or event.params.data
    - Call decreaseStock before calling recomputeOrderTotal
    - Maintain existing order total recalculation logic
    - Allow errors to propagate automatically (no try-catch)
    - _Requirements: 5.4, 6.1, 6.2, 6.3, 6.4, 9.1, 9.3, 9.4_
  
  - [ ]* 7.2 Write unit tests for afterCreate integration
    - Test stock decreases after successful creation
    - Test order total recalculation runs after stock adjustment
    - Test stock remains unchanged when creation fails validation
    - _Requirements: 5.3, 5.4, 6.3_
  
  - [ ]* 7.3 Write property test for successful validation preserving functionality
    - **Property 5: Successful validation preserves existing functionality**
    - **Validates: Requirements 5.4**

- [x] 8. Update afterUpdate hook for stock adjustment
  - [x] 8.1 Modify existing afterUpdate hook
    - Retrieve previous quantity from event context (stored in beforeUpdate)
    - Extract product ID from event.result
    - Extract new quantity from event.result
    - Call adjustStockByDelta with product ID, previous quantity, and new quantity
    - Call adjustStockByDelta before calling recomputeOrderTotal
    - Maintain existing order total recalculation logic
    - Allow errors to propagate automatically (no try-catch)
    - _Requirements: 5.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.1, 9.3, 9.4_
  
  - [ ]* 8.2 Write unit tests for afterUpdate integration
    - Test stock decreases when quantity increases
    - Test stock increases when quantity decreases
    - Test stock unchanged when quantity unchanged
    - Test order total recalculation runs after stock adjustment
    - _Requirements: 7.3, 7.4, 7.5, 10.1_

- [x] 9. Update afterDelete hook for stock restoration
  - [x] 9.1 Modify existing afterDelete hook
    - Extract product ID from deleted order item(s)
    - Extract quantity from deleted order item(s)
    - Call increaseStock before calling recomputeOrderTotal for each deleted item
    - Handle both single and bulk deletion scenarios
    - Wrap increaseStock in try-catch to log warnings for missing products
    - Allow deletion to complete even if stock restoration fails
    - Maintain existing order total recalculation logic
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 10.2_
  
  - [ ]* 9.2 Write unit tests for afterDelete integration
    - Test stock increases after deletion
    - Test order total recalculation runs after stock restoration
    - Test deletion succeeds when product no longer exists (with warning log)
    - Test bulk deletion handles multiple order items correctly
    - _Requirements: 8.4, 8.5, 10.2_

- [x] 10. Final integration and atomicity testing
  - [ ]* 10.1 Write property test for stock adjustment atomicity
    - **Property 9: Stock adjustment atomicity**
    - **Validates: Requirements 6.4, 7.6, 9.1, 9.3, 9.4**
  
  - [ ]* 10.2 Write property test for stock non-negativity invariant
    - **Property 10: Stock level non-negativity invariant**
    - **Validates: Requirements 10.4**
  
  - [ ]* 10.3 Write integration tests for complete workflows
    - Test create → update → delete sequence maintains correct stock
    - Test multiple concurrent order items for same product
    - Test validation failure prevents all side effects (stock, order total)
    - Test stock adjustment failure rolls back order item operation
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All stock operations use atomic database updates within Strapi's transaction system
- Property tests use fast-check library with minimum 100 iterations
- Validation occurs in beforeCreate/beforeUpdate hooks (before database write)
- Stock adjustments occur in afterCreate/afterUpdate/afterDelete hooks (after database write)
- Order total recalculation runs after stock adjustments in all hooks
- Transaction atomicity ensures either all operations succeed or all fail together
