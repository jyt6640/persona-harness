# Backend API Service

Build a backend API for a small order intake service.

The service should let a caller create customers, create orders for those customers, update order status, and read order summaries.
Do not build a frontend.

## Core Behavior

- A customer has a display name and email address.
- An order belongs to one customer.
- An order has one or more line items.
- Each line item has a sku, quantity, and unit price.
- Order status starts as `draft`.
- Valid status values are `draft`, `submitted`, `paid`, `cancelled`, and `fulfilled`.
- A submitted or paid order cannot be changed back to draft.
- A fulfilled order cannot be cancelled.
- A cancelled order cannot be paid or fulfilled.

## API Requirements

Provide endpoints or equivalent API operations for:

- create a customer;
- list customers;
- create an order for a customer;
- add a line item to a draft order;
- submit a draft order;
- mark a submitted order as paid;
- mark a paid order as fulfilled;
- cancel a draft or submitted order;
- read one order summary;
- list orders filtered by status.

## Validation

- Reject customer creation when email is missing or malformed.
- Reject order creation for an unknown customer.
- Reject line items with missing sku, zero quantity, negative quantity, or negative price.
- Reject invalid status transitions with a clear error response.

## Persistence

Persist data across process restarts in whatever local persistence mechanism is appropriate for the chosen implementation.

## Tests

Include automated tests for:

- happy path from customer creation to fulfilled order;
- invalid customer email;
- invalid line item quantity;
- invalid transition from cancelled to paid;
- order listing by status.

## Deliverable

The result should be a runnable backend project with clear build, test, and run commands documented in the generated project.
