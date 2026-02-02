-- Add new fields to staff_profiles table for enhanced user creation

-- Secondary phone number (optional)
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(20);

-- KRA PIN
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS kra_pin VARCHAR(50);

-- Highest level of education
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS education_level VARCHAR(100);

-- Next of Kin information (optional, can be filled later)
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS next_of_kin_name VARCHAR(255);

ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS next_of_kin_phone VARCHAR(20);

ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS next_of_kin_id_number VARCHAR(50);

ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS next_of_kin_relationship VARCHAR(100);

-- Display updated schema
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'staff_profiles' 
ORDER BY ordinal_position;
