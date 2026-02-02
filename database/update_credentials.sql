-- Update user credentials with new password: Password@0609
-- Hash: $2b$10$EvcTzRXjegPHpR6DXLcnpO7JhpzxyKF41NGH7kUocBd.b5ZeYdW92

-- Update existing CEO account
UPDATE users 
SET email = 'ceo@winassacco.co.ke', 
    password_hash = '$2b$10$EvcTzRXjegPHpR6DXLcnpO7JhpzxyKF41NGH7kUocBd.b5ZeYdW92'
WHERE email = 'ceo@winassacco.co.ke';

-- Update existing HOD Finance account
UPDATE users 
SET password_hash = '$2b$10$EvcTzRXjegPHpR6DXLcnpO7JhpzxyKF41NGH7kUocBd.b5ZeYdW92'
WHERE email = 'hod.finance@winassacco.co.ke';

-- Update existing HOD ICT account
UPDATE users 
SET password_hash = '$2b$10$EvcTzRXjegPHpR6DXLcnpO7JhpzxyKF41NGH7kUocBd.b5ZeYdW92'
WHERE email = 'hod.ict@winassacco.co.ke';

-- Update existing Supervisor Finance account
UPDATE users 
SET password_hash = '$2b$10$EvcTzRXjegPHpR6DXLcnpO7JhpzxyKF41NGH7kUocBd.b5ZeYdW92'
WHERE email = 'supervisor.finance@winassacco.co.ke';

-- Add new HR Manager account (replacing hr@winassacco.co.ke with hr.manager@winassacco.co.ke)
INSERT INTO users (email, password_hash, role_id, department_id, is_active) VALUES
('hr.manager@winassacco.co.ke', '$2b$10$EvcTzRXjegPHpR6DXLcnpO7JhpzxyKF41NGH7kUocBd.b5ZeYdW92', 4, 6, true)
ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2b$10$EvcTzRXjegPHpR6DXLcnpO7JhpzxyKF41NGH7kUocBd.b5ZeYdW92';

-- Add profile for HR Manager if not exists
INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, phone, date_joined, job_title)
SELECT 
    u.id, 
    'HR', 
    'Manager', 
    'EMP020', 
    '+254722223333', 
    CURRENT_DATE, 
    'HR Manager'
FROM users u
WHERE u.email = 'hr.manager@winassacco.co.ke'
AND NOT EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = u.id);

-- Add new Staff member: john.kamau@winassacco.co.ke
INSERT INTO users (email, password_hash, role_id, department_id, supervisor_id, is_active) VALUES
('john.kamau@winassacco.co.ke', '$2b$10$EvcTzRXjegPHpR6DXLcnpO7JhpzxyKF41NGH7kUocBd.b5ZeYdW92', 6, 1, 8, true)
ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2b$10$EvcTzRXjegPHpR6DXLcnpO7JhpzxyKF41NGH7kUocBd.b5ZeYdW92';

-- Add profile for john.kamau if not exists
INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, phone, date_joined, job_title)
SELECT 
    u.id, 
    'John', 
    'Kamau', 
    'EMP021', 
    '+254733334444', 
    CURRENT_DATE, 
    'Finance Officer'
FROM users u
WHERE u.email = 'john.kamau@winassacco.co.ke'
AND NOT EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = u.id);

-- Verification query - run this to confirm the updates
SELECT 
    u.email, 
    r.name as role, 
    sp.first_name, 
    sp.last_name,
    d.name as department
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN staff_profiles sp ON u.id = sp.user_id
LEFT JOIN departments d ON u.department_id = d.id
WHERE u.email IN (
    'ceo@winassacco.co.ke',
    'hr.manager@winassacco.co.ke',
    'john.kamau@winassacco.co.ke',
    'hod.finance@winassacco.co.ke',
    'hod.ict@winassacco.co.ke',
    'supervisor.finance@winassacco.co.ke'
)
ORDER BY r.level;
