# Purchase Tracking Setup Guide

## Overview
The purchase tracking feature prevents users from buying the same course twice. Once a course is purchased, the "Buy Now" button is disabled and shows "Already Enrolled ✓".

## Database Setup

### Prerequisites
- Access to your Supabase or PostgreSQL database
- User profile is already set up and working

### Step 1: Create the `user_purchases` Table

Run the SQL migration from `scripts/create-purchases-table.sql` in your Supabase SQL editor:

```sql
CREATE TABLE IF NOT EXISTS user_purchases (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  course_id INTEGER NOT NULL,
  course_title TEXT NOT NULL,
  purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(uid, course_id),
  CONSTRAINT valid_ids CHECK (uid != '' AND course_id > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_purchases_uid ON user_purchases(uid);
CREATE INDEX IF NOT EXISTS idx_user_purchases_course_id ON user_purchases(course_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_purchase_date ON user_purchases(purchase_date DESC);

GRANT SELECT, INSERT ON user_purchases TO postgres;
GRANT USAGE, SELECT ON SEQUENCE user_purchases_id_seq TO postgres;
```

### Step 2: Verify Table Creation

In Supabase, you should see the new `user_purchases` table in the Tables section.

## How It Works

### Backend APIs

Three new endpoints added to `/api/profile/:uid`:

1. **GET `/api/profile/:uid/purchases`**
   - Returns all purchases for a user
   - Response: `{ purchases: [{ courseId, courseTitle, purchaseDate }, ...] }`

2. **GET `/api/profile/:uid/purchased/:courseId`**
   - Checks if user has purchased a specific course
   - Response: `{ purchased: true|false }`

3. **POST `/api/profile/:uid/purchases`**
   - Records a new purchase
   - Body: `{ courseId: number, courseTitle: string }`
   - Returns: `{ ok: true, purchase: {...} }`

### Frontend Flow

1. **Checkout Page** (`/public/js/checkout-page.js`)
   - When checkout completes with admin code
   - Gets current Firebase user ID and ID token
   - Calls POST `/api/profile/:uid/purchases` to record the purchase

2. **Course Detail Page** (`/views/course-detail.ejs`)
   - On page load, checks if current user has purchased the course
   - Calls GET `/api/profile/:uid/purchased/:courseId`
   - If purchased: disables "Buy Now" button and shows "Already Enrolled ✓"
   - If not purchased: button remains enabled

## Testing

### Test Scenario 1: First-time Purchase
1. Sign in to your account
2. Go to any course detail page
3. "Buy Now" button should be enabled
4. Click Enroll → Get More Information (or proceed to Buy Now)
5. Click Buy Now → Enter country → Enter admin code (Aa@1Dhyanam)
6. Purchase recorded successfully

### Test Scenario 2: Prevent Duplicate Purchase
1. After Step 6 above, stay on the course detail page or navigate away
2. Go back to the same course detail page
3. "Buy Now" button should now show "Already Enrolled ✓"
4. Button should be disabled (grayed out, cursor: default)

### Test Scenario 3: Guest User
1. Log out or use incognito/private browsing
2. Go to any course detail page
3. "Buy Now" button should be enabled (no purchase check for guests)
4. Try to checkout as guest (will need to sign in first in real app)

## Database Troubleshooting

**Q: Getting "relation 'user_purchases' does not exist" error?**
- The table hasn't been created yet. Run the SQL migration from step 1.

**Q: Getting unique constraint violation when trying to record purchase?**
- The user already has a purchase for that course (this is expected and handled with idempotent insert)

**Q: Purchase not showing up?**
- Check that:
  1. User is signed in (Firebase auth)
  2. ID token is valid and sent in Authorization header
  3. Database connection string is set (SUPABASE_DB_URL or DATABASE_URL)
  4. User UID matches between Firebase and your database

## Future Enhancements

- Dashboard page to show "My Courses" (already purchased)
- Purchase history with dates and countries
- Admin panel to view all purchases
- Bulk purchase/gifting features
- Purchase receipts/invoices
- Refund workflow
