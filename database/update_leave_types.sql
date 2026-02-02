-- Update Maternity/Paternity Leave Types
-- Split Maternity Leave: 14 days for men, 30 days for women

-- First, rename existing Maternity Leave to Maternity Leave (Female)
UPDATE leave_types 
SET name = 'Maternity Leave (Female)', 
    description = 'Maternity leave for female employees',
    days_allowed = 30
WHERE name = 'Maternity Leave';

-- Update Paternity Leave days
UPDATE leave_types 
SET days_allowed = 14,
    name = 'Paternity Leave (Male)',
    description = 'Paternity leave for male employees'
WHERE name = 'Paternity Leave';

-- Verify the updates
SELECT id, name, description, days_allowed, requires_document, is_paid, carry_forward 
FROM leave_types 
WHERE name LIKE '%Maternity%' OR name LIKE '%Paternity%'
ORDER BY name;
