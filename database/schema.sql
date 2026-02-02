-- Winas Sacco HRMS Database Schema
-- PostgreSQL Database Schema

-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS appraisal_scores CASCADE;
DROP TABLE IF EXISTS appraisals CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS leave_types CASCADE;
DROP TABLE IF EXISTS staff_profiles CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- Roles table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    level INTEGER NOT NULL, -- Hierarchy level: 1=Super Admin, 2=CEO, 3=HOD, 4=HR, 5=Supervisor, 6=Staff
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    department_id INTEGER REFERENCES departments(id),
    supervisor_id INTEGER REFERENCES users(id), -- For staff, points to their supervisor
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_supervisor ON users(supervisor_id);

-- Staff profiles table (extended user information)
CREATE TABLE staff_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    employee_number VARCHAR(50) UNIQUE,
    national_id VARCHAR(50) UNIQUE,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10),
    marital_status VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    date_joined DATE,
    job_title VARCHAR(100),
    profile_picture_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_staff_user ON staff_profiles(user_id);
CREATE INDEX idx_staff_employee_number ON staff_profiles(employee_number);

-- Leave types table
CREATE TABLE leave_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    days_allowed INTEGER NOT NULL DEFAULT 0,
    requires_document BOOLEAN DEFAULT false,
    is_paid BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    carry_forward BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave requests table
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, Supervisor Approved, Approved, Rejected
    supervisor_id INTEGER REFERENCES users(id),
    supervisor_status VARCHAR(20), -- Pending, Approved, Rejected
    supervisor_comment TEXT,
    supervisor_action_at TIMESTAMP,
    hr_id INTEGER REFERENCES users(id),
    hr_status VARCHAR(20), -- Pending, Approved, Rejected
    hr_comment TEXT,
    hr_action_at TIMESTAMP,
    document_url TEXT,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leave_user ON leave_requests(user_id);
CREATE INDEX idx_leave_status ON leave_requests(status);
CREATE INDEX idx_leave_supervisor ON leave_requests(supervisor_id);
CREATE INDEX idx_leave_dates ON leave_requests(start_date, end_date);

-- Appraisals table
CREATE TABLE appraisals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    supervisor_id INTEGER NOT NULL REFERENCES users(id),
    hr_id INTEGER REFERENCES users(id),
    period_type VARCHAR(20) NOT NULL, -- Quarterly, Annual
    period_year INTEGER NOT NULL,
    period_quarter INTEGER, -- 1-4, NULL for annual
    status VARCHAR(20) NOT NULL DEFAULT 'Draft', -- Draft, Submitted, Reviewed, Finalized
    overall_score DECIMAL(3,2), -- Average score 1.00 - 5.00
    supervisor_comment TEXT,
    hr_comment TEXT,
    finalized_at TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appraisal_user ON appraisals(user_id);
CREATE INDEX idx_appraisal_supervisor ON appraisals(supervisor_id);
CREATE INDEX idx_appraisal_period ON appraisals(period_year, period_quarter);

-- Appraisal scores table (detailed ratings)
CREATE TABLE appraisal_scores (
    id SERIAL PRIMARY KEY,
    appraisal_id INTEGER NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
    criteria VARCHAR(100) NOT NULL, -- Attendance, Work Quality, Teamwork, Communication, Initiative, Goal Achievement
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appraisal_scores ON appraisal_scores(appraisal_id);

-- Audit logs table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- User, Department, Leave, Appraisal, etc.
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- System settings table
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) NOT NULL DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    is_public BOOLEAN DEFAULT false, -- Can be accessed without auth
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settings_key ON system_settings(setting_key);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_profiles_updated_at BEFORE UPDATE ON staff_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_types_updated_at BEFORE UPDATE ON leave_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appraisals_updated_at BEFORE UPDATE ON appraisals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appraisal_scores_updated_at BEFORE UPDATE ON appraisal_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
