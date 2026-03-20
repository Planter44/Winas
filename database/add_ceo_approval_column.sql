-- Add requires_ceo_approval column to leave_requests table
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS requires_ceo_approval BOOLEAN DEFAULT false;

-- Add ceo_status column for CEO approval tracking
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS ceo_status VARCHAR(20) DEFAULT 'Pending';

-- Add ceo_id column to track which CEO approved
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS ceo_id INTEGER REFERENCES users(id);

-- Add ceo_response_date column
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS ceo_response_date TIMESTAMP;

-- Add ceo_comment column
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS ceo_comment TEXT;

-- Update existing HR and HOD leave requests to require CEO approval
UPDATE leave_requests lr
SET requires_ceo_approval = true
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE lr.user_id = u.id 
  AND (r.name = 'HR' OR r.name = 'HOD')
  AND lr.status = 'Pending';

-- Display updated schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leave_requests'
ORDER BY ordinal_position;
