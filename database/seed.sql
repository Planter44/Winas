-- Winas Sacco HRMS Seed Data
-- Creates initial roles, departments, Super Admin, and sample data

-- Insert Roles (hierarchy levels: 1=highest authority)
INSERT INTO roles (name, description, level) VALUES
('Super Admin', 'Full system control, above all other roles', 1),
('CEO', 'Chief Executive Officer, top executive', 2),
('HOD', 'Head of Department, departmental leadership', 3),
('HR', 'Human Resources, central HR authority', 4),
('Supervisor', 'Department supervisors, first-level management', 5),
('Staff', 'Regular staff members', 6);

-- Insert Departments
INSERT INTO departments (name, description) VALUES
('Finance', 'Financial operations and accounting'),
('ICT', 'Information and Communication Technology'),
('Admin', 'Administrative services and operations'),
('Marketing', 'Marketing and customer relations'),
('Operations', 'Core business operations'),
('Human Resources', 'HR department');

-- Insert Super Admin user
-- Password: Admin@0010 (hashed with bcrypt, rounds=10)
-- Hash generated for: Admin@0010
INSERT INTO users (email, password_hash, role_id, is_active) VALUES
('johnsonmuhabi@gmail.com', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 1, true);

-- Insert Super Admin profile
INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, phone, date_joined, job_title) VALUES
(1, 'Johnson', 'Muhabi', 'EMP001', '+254700000000', '2024-01-01', 'Super Administrator');

-- Insert CEO
INSERT INTO users (email, password_hash, role_id, is_active) VALUES
('ceo@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 2, true);

INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, phone, date_joined, job_title) VALUES
(2, 'Sarah', 'Wanjiru', 'EMP002', '+254711111111', '2024-01-01', 'Chief Executive Officer');

-- Insert HR Manager
INSERT INTO users (email, password_hash, role_id, department_id, is_active) VALUES
('hr@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 4, 6, true);

INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, phone, date_joined, job_title) VALUES
(3, 'Mary', 'Kamau', 'EMP003', '+254722222222', '2024-01-15', 'HR Manager');

-- Insert HODs for each department
INSERT INTO users (email, password_hash, role_id, department_id, is_active) VALUES
('hod.finance@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 3, 1, true),
('hod.ict@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 3, 2, true),
('hod.admin@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 3, 3, true),
('hod.marketing@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 3, 4, true);

INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, phone, date_joined, job_title) VALUES
(4, 'Peter', 'Ochieng', 'EMP004', '+254733333333', '2024-02-01', 'Head of Finance'),
(5, 'Jane', 'Muthoni', 'EMP005', '+254744444444', '2024-02-01', 'Head of ICT'),
(6, 'David', 'Kiprop', 'EMP006', '+254755555555', '2024-02-01', 'Head of Admin'),
(7, 'Grace', 'Akinyi', 'EMP007', '+254766666666', '2024-02-01', 'Head of Marketing');

-- Insert Supervisors (one per department)
INSERT INTO users (email, password_hash, role_id, department_id, is_active) VALUES
('supervisor.finance@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 5, 1, true),
('supervisor.ict@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 5, 2, true),
('supervisor.admin@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 5, 3, true),
('supervisor.marketing@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 5, 4, true);

INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, phone, date_joined, job_title) VALUES
(8, 'James', 'Kibet', 'EMP008', '+254777777777', '2024-03-01', 'Finance Supervisor'),
(9, 'Alice', 'Wangari', 'EMP009', '+254788888888', '2024-03-01', 'ICT Supervisor'),
(10, 'Robert', 'Otieno', 'EMP010', '+254799999999', '2024-03-01', 'Admin Supervisor'),
(11, 'Lucy', 'Njeri', 'EMP011', '+254700111111', '2024-03-01', 'Marketing Supervisor');

-- Insert Sample Staff (2 per department, assigned to supervisors)
INSERT INTO users (email, password_hash, role_id, department_id, supervisor_id, is_active) VALUES
('john.doe@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 6, 1, 8, true),
('jane.smith@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 6, 1, 8, true),
('michael.brown@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 6, 2, 9, true),
('susan.wilson@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 6, 2, 9, true),
('daniel.taylor@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 6, 3, 10, true),
('emily.davis@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 6, 3, 10, true),
('patrick.moore@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 6, 4, 11, true),
('rachel.jackson@winassacco.co.ke', '$2b$10$N5YmHxZF5jvXJ7mBBGvqaOqJ5QGJxVxZWJvJYJ9rXn3JFOYKqQg5m', 6, 4, 11, true);

INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, phone, date_joined, job_title) VALUES
(12, 'John', 'Doe', 'EMP012', '+254700222222', '2024-04-01', 'Accountant'),
(13, 'Jane', 'Smith', 'EMP013', '+254700333333', '2024-04-01', 'Finance Officer'),
(14, 'Michael', 'Brown', 'EMP014', '+254700444444', '2024-04-01', 'Systems Analyst'),
(15, 'Susan', 'Wilson', 'EMP015', '+254700555555', '2024-04-01', 'IT Support'),
(16, 'Daniel', 'Taylor', 'EMP016', '+254700666666', '2024-04-01', 'Admin Officer'),
(17, 'Emily', 'Davis', 'EMP017', '+254700777777', '2024-04-01', 'Receptionist'),
(18, 'Patrick', 'Moore', 'EMP018', '+254700888888', '2024-04-01', 'Marketing Officer'),
(19, 'Rachel', 'Jackson', 'EMP019', '+254700999999', '2024-04-01', 'Sales Executive');

-- Insert Leave Types
INSERT INTO leave_types (name, description, days_allowed, requires_document, is_paid, carry_forward) VALUES
('Annual Leave', 'Annual paid vacation leave', 21, false, true, true),
('Sick Leave', 'Medical sick leave', 14, true, true, false),
('Maternity Leave', 'Maternity leave for female employees', 90, true, true, false),
('Paternity Leave', 'Paternity leave for male employees', 14, true, true, false),
('Compassionate Leave', 'Leave for family emergencies or bereavement', 7, true, true, false),
('Study Leave', 'Educational or professional development leave', 10, true, false, false),
('Emergency Leave', 'Urgent personal matters', 3, false, true, false),
('Unpaid Leave', 'Leave without pay', 30, false, false, false);

-- Insert System Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('company_name', 'Winas Sacco', 'string', 'Company name displayed across the system', true),
('company_logo_url', '', 'string', 'URL to company logo', true),
('company_email', 'info@winassacco.co.ke', 'string', 'Official company email', true),
('company_phone', '+254 700 000 000', 'string', 'Official company phone', true),
('company_address', 'Nakuru, Kenya', 'string', 'Company physical address', true),
('dashboard_card_gradient_opacity', '65', 'number', 'Opacity for dashboard card gradients (0-100)', true),
('leave_approval_levels', '2', 'number', 'Number of approval levels for leave (Supervisor + HR)', false),
('appraisal_frequency', 'Quarterly', 'string', 'Default appraisal frequency', false),
('financial_year_start', '01-01', 'string', 'Financial year start date (MM-DD)', false),
('max_leave_days_per_year', '50', 'number', 'Maximum total leave days per year', false);

-- Insert sample leave requests (for demonstration)
INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days_requested, reason, status, supervisor_id) VALUES
(12, 1, '2024-06-01', '2024-06-05', 5, 'Family vacation', 'Pending', 8),
(14, 2, '2024-05-20', '2024-05-22', 3, 'Medical appointment', 'Approved', 9);

-- Update the second leave request to show full approval workflow
UPDATE leave_requests SET 
    supervisor_status = 'Approved',
    supervisor_comment = 'Approved by supervisor',
    supervisor_action_at = CURRENT_TIMESTAMP,
    hr_id = 3,
    hr_status = 'Approved',
    hr_comment = 'Approved by HR',
    hr_action_at = CURRENT_TIMESTAMP,
    status = 'Approved'
WHERE id = 2;

-- Insert sample appraisals
INSERT INTO appraisals (user_id, supervisor_id, hr_id, period_type, period_year, period_quarter, status, overall_score, supervisor_comment, hr_comment, finalized_at) VALUES
(12, 8, 3, 'Quarterly', 2024, 1, 'Finalized', 4.20, 'Excellent performance in Q1', 'Consistent quality work', '2024-04-15 10:00:00');

-- Insert appraisal scores for the sample appraisal
INSERT INTO appraisal_scores (appraisal_id, criteria, score, comment) VALUES
(1, 'Attendance', 5, 'Perfect attendance record'),
(1, 'Work Quality', 4, 'High quality deliverables'),
(1, 'Teamwork', 4, 'Good collaboration with team'),
(1, 'Communication', 4, 'Clear and effective communication'),
(1, 'Initiative', 4, 'Shows proactive approach'),
(1, 'Goal Achievement', 4, 'Met all quarterly targets');

-- Insert audit log sample
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES
(1, 'LOGIN', 'User', 1, '{"ip": "127.0.0.1", "timestamp": "2024-01-29"}'),
(3, 'APPROVE_LEAVE', 'Leave', 2, '{"leave_id": 2, "action": "approved", "comment": "Approved by HR"}');

-- Note: Default password for all demo accounts is: Admin@0010
-- Super Admin: johnsonmuhabi@gmail.com / Admin@0010
