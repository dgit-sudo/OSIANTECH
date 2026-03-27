# Razorpay Full Setup Runbook (VM + Dashboard)

This is the single file for both tasks:

1. Configure VM environment variables.
2. Configure Razorpay dashboard endpoints/webhooks.

It also includes validation commands so you can confirm everything is wired correctly.

---

## 0) Replace Placeholders First

Replace these values before running commands:

- `<RAZORPAY_KEY_ID>`
- `<RAZORPAY_KEY_SECRET>`
- `<RAZORPAY_WEBHOOK_SECRET>`

Fixed deployment values:

- VM IP: `159.223.205.222`
- Domain: `osian.tech`

App base URL:

- `https://osian.tech`

---

## 1) Get Razorpay Credentials (Dashboard)

In Razorpay dashboard:

1. Go to `Settings -> API Keys`.
2. Generate keys (start with Test mode first).
3. Copy:
   - `Key ID`
   - `Key Secret`
4. Go to `Settings -> Webhooks`.
5. Create webhook and set your webhook secret.
6. Copy webhook secret value.

---

## 2) Add ENV Variables on VM (Exact Commands)

Run these commands on server:

```bash
ssh root@159.223.205.222
cd /var/www/OSIANTECH
cp .env ".env.backup.$(date +%Y%m%d-%H%M%S)"
cat >> .env << 'EOF'
RAZORPAY_KEY_ID=rzp_live_SWIajXktt7Mahe
RAZORPAY_KEY_SECRET=NNHipsj3FEakMfVnx2cmiEf7
RAZORPAY_WEBHOOK_SECRET=Tintable@965
GST_IN_PERCENT=18
GST_GLOBAL_PERCENT=0
EOF
npm install --omit=dev
pm2 restart osiantech
pm2 status
pm2 logs osiantech --lines 80 --nostream
```

---

## 3) Razorpay Dashboard Endpoint Configuration

### 3.1 Checkout/Order Flow Endpoints (Already Implemented)

Use these app endpoints in your flow:

- `GET /courses/checkout/config`
  - Returns Razorpay key availability and defaults.

- `POST /courses/checkout/context`
  - Returns country/currency suggestion.

- `POST /courses/:id/checkout/quote`
  - Returns base fee, GST, total payable, currency decision.

- `POST /courses/:id/checkout/create-order`
  - Creates Razorpay order and returns `orderId`, amount, currency, key.

- `POST /courses/:id/checkout/verify-payment`
  - Verifies Razorpay signature server-side and records purchase idempotently.

### 3.2 Webhook URL in Razorpay Dashboard

Webhook URL to set in Razorpay dashboard:

- `https://osian.tech/courses/checkout/webhook/razorpay`

Events to enable:

- `payment.captured`
- `payment.failed`
- `order.paid`

Note:

- Current production flow already verifies payment via `verify-payment` endpoint.
- Webhook is for async reconciliation and failure/capture sync.

---

## 4) Functional Rules Implemented

1. Single-course checkout only (no cart).
2. Same user cannot purchase same course more than once.
3. If location permission is denied, metro fee is used.
4. GST is separate from base fee.
5. Currency is selected by user from footer dropdown.
6. Default currency by location/locale; fallback `INR` if location unavailable.
7. If selected currency is unsupported by Razorpay, fallback uses `USD/INR` with same numeric amount (current business rule).

---

## 5) Quick Health Checks (After Deployment)

Run from VM:

```bash
cd /var/www/OSIANTECH
pm2 status
curl -s https://osian.tech/courses/checkout/config | cat
```

Expected:

- `razorpayEnabled` should be `true`.
- App process `osiantech` should be `online`.

---

## 6) Troubleshooting

If `razorpayEnabled` is false:

1. Check `.env` keys are present and non-empty.
2. Restart PM2:
   - `pm2 restart osiantech`
3. Re-check endpoint:
  - `curl -s https://osian.tech/courses/checkout/config | cat`

If payment popup fails:

1. Ensure HTTPS is active on domain.
2. Ensure Razorpay keys are from correct mode (Test vs Live).
3. Check browser console and PM2 logs for failed order creation.

---

## 7) Security Notes

1. Never commit real Razorpay secrets to git.
2. Keep secrets only in server `.env`.
3. Rotate keys immediately if exposed.
