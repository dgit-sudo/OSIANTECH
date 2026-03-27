# Razorpay Dashboard Endpoints

Use this file while configuring Razorpay dashboard webhooks and validating server endpoints.

## Base URL

Replace `<YOUR_DOMAIN>` with your production domain.

- App base URL: `https://<YOUR_DOMAIN>`

## Implemented Checkout Endpoints

- `GET /courses/checkout/config`
  - Returns Razorpay public key availability and defaults.

- `POST /courses/checkout/context`
  - Returns country/currency suggestion.

- `POST /courses/:id/checkout/quote`
  - Returns base fee, GST, total, and currency decision.

- `POST /courses/:id/checkout/create-order`
  - Creates Razorpay order and returns `orderId`, amount, and key.

- `POST /courses/:id/checkout/verify-payment`
  - Verifies Razorpay signature and records purchase idempotently.

## Suggested Razorpay Webhook Configuration

Current release validates payment via signature callback endpoint. Webhook endpoint can be added next for async reconciliation.

If you configure webhook in Razorpay now, use this planned endpoint:

- Webhook URL: `https://<YOUR_DOMAIN>/courses/checkout/webhook/razorpay`
- Events to enable:
  - `payment.captured`
  - `payment.failed`
  - `order.paid`

## Required Environment Variables

Add these in VM `.env`:

- `RAZORPAY_KEY_ID=...`
- `RAZORPAY_KEY_SECRET=...`
- `RAZORPAY_WEBHOOK_SECRET=...` (for webhook rollout)
- `GST_IN_PERCENT=18`
- `GST_GLOBAL_PERCENT=0`

## Notes

- Checkout is single-course only (no cart).
- Duplicate purchase protection is enforced by `(uid, course_id)` uniqueness and server checks.
- If selected currency is unsupported by Razorpay, server falls back to `USD`/`INR` while keeping the same numeric amount per current business rule.
