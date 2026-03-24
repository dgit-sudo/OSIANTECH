-- Create user_purchases table to track course enrollments
-- Run this SQL in your Supabase or PostgreSQL database

CREATE TABLE IF NOT EXISTS user_purchases (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  course_id INTEGER NOT NULL,
  course_title TEXT NOT NULL,
  purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique purchase per user per course
  UNIQUE(uid, course_id),
  
  -- Add foreign key constraint to app_users if you want
  -- FOREIGN KEY (uid) REFERENCES app_users(uid) ON DELETE CASCADE
  
  -- Add indexes for faster queries
  CONSTRAINT valid_ids CHECK (uid != '' AND course_id > 0)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_purchases_uid ON user_purchases(uid);
CREATE INDEX IF NOT EXISTS idx_user_purchases_course_id ON user_purchases(course_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_purchase_date ON user_purchases(purchase_date DESC);

-- Grant permissions to your app user (replace 'postgres' with your actual app user)
GRANT SELECT, INSERT ON user_purchases TO postgres;
GRANT USAGE, SELECT ON SEQUENCE user_purchases_id_seq TO postgres;
