-- Minimal seed data for production
-- Creates required roles, departments, leave types, public system settings, and a Super Admin account.

-- Insert Roles (hierarchy levels: 1=highest authority)
INSERT INTO roles (name, description, level) VALUES
('Super Admin', 'Full system control, above all other roles', 1),
('CEO', 'Chief Executive Officer, top executive', 2),
('HOD', 'Head of Department, departmental leadership', 3),
('HR', 'Human Resources, central HR authority', 4),
('Supervisor', 'Department supervisors, first-level management', 5),
('Staff', 'Regular staff members', 6)
ON CONFLICT (name) DO NOTHING;

-- Insert Departments
INSERT INTO departments (name, description) VALUES
('Finance', 'Financial operations and accounting'),
('ICT', 'Information and Communication Technology'),
('Admin', 'Administrative services and operations'),
('Marketing', 'Marketing and customer relations'),
('Operations', 'Core business operations'),
('Human Resources', 'HR department')
ON CONFLICT (name) DO NOTHING;

-- Insert Leave Types
INSERT INTO leave_types (name, description, days_allowed, requires_document, is_paid, carry_forward) VALUES
('Annual Leave', 'Annual paid vacation leave', 21, false, true, true),
('Sick Leave', 'Medical sick leave', 14, true, true, false),
('Maternity Leave', 'Maternity leave for female employees', 90, true, true, false),
('Paternity Leave', 'Paternity leave for male employees', 14, true, true, false),
('Compassionate Leave', 'Leave for family emergencies or bereavement', 7, true, true, false),
('Study Leave', 'Educational or professional development leave', 10, true, false, false),
('Emergency Leave', 'Urgent personal matters', 3, false, true, false),
('Unpaid Leave', 'Leave without pay', 30, false, false, false)
ON CONFLICT (name) DO NOTHING;

-- Insert System Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES
('company_name', 'Winas Sacco', 'string', 'Company name displayed across the system', true),
('company_logo_url', '', 'string', 'URL to company logo', true),
('company_email', 'info@winassacco.co.ke', 'string', 'Official company email', true),
('company_phone', '+254 700 000 000', 'string', 'Official company phone', true),
('company_address', 'Nakuru, Kenya', 'string', 'Company physical address', true),
('primary_color', '#2563eb', 'string', 'Primary brand color', true),
('secondary_color', '#10b981', 'string', 'Secondary brand color', true),
('sidebar_bg_color', '#ffffff', 'string', 'Sidebar background color', true),
('header_bg_color', '#ffffff', 'string', 'Header background color', true),
('page_bg_color', '#f9fafb', 'string', 'Page background color', true),
('font_family', 'Inter', 'string', 'Primary font family', true),
('sidebar_width', 'normal', 'string', 'Sidebar width', true),
('card_style', 'rounded', 'string', 'Card style', true),
('dashboard_card_gradient_opacity', '65', 'number', 'Opacity for dashboard card gradients (0-100)', true),
('dashboard_title', 'Dashboard', 'string', 'Dashboard page title', true),
('leaves_title', 'Leave Management', 'string', 'Leave management page title', true),
('users_title', 'Users', 'string', 'Users page title', true),
('departments_title', 'Departments', 'string', 'Departments page title', true),
('login_welcome_text', 'Welcome to HRMS', 'string', 'Login welcome headline', true),
('login_subtitle', 'Sign in to your account', 'string', 'Login subtitle', true),
('footer_enabled', 'true', 'boolean', 'Footer enabled flag', true),
('footer_content', '© 2024 Winas Sacco. All rights reserved.', 'string', 'Footer content', true),
('theme_mode', 'light', 'string', 'Theme mode (light/dark)', true),
('hamburger_style', 'classic', 'string', 'Hamburger menu style', true),
('hamburger_color', '#2563eb', 'string', 'Hamburger menu color', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert Super Admin user
-- Password: Admin@0010 (hashed with bcrypt, rounds=10)
INSERT INTO users (email, password_hash, role_id, is_active)
SELECT
  'johnsonmuhabi@gmail.com',
  '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m',
  r.id,
  true
FROM roles r
WHERE r.name = 'Super Admin'
ON CONFLICT (email)
DO UPDATE SET password_hash = EXCLUDED.password_hash,
              role_id = EXCLUDED.role_id,
              is_active = EXCLUDED.is_active,
              updated_at = CURRENT_TIMESTAMP;

-- Insert Super Admin profile (safe even if user id isn't 1)
INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, phone, date_joined, job_title)
SELECT
  u.id,
  'Johnson',
  'Muhabi',
  'EMP001',
  '+254700000000',
  '2024-01-01',
  'Super Administrator'
FROM users u
WHERE u.email = 'johnsonmuhabi@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
