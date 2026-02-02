-- WINAS SACCO Performance Appraisal Database Schema
-- This migration creates the new appraisal structure

-- Drop existing tables if they exist (careful in production!)
-- DROP TABLE IF EXISTS appraisal_scores CASCADE;
-- DROP TABLE IF EXISTS appraisals CASCADE;

-- Performance Appraisal Pillars (Membership, Finance, Credit, Operations, etc.)
CREATE TABLE IF NOT EXISTS appraisal_pillars (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Key Result Areas under each Pillar
CREATE TABLE IF NOT EXISTS appraisal_kras (
    id SERIAL PRIMARY KEY,
    pillar_id INTEGER REFERENCES appraisal_pillars(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight DECIMAL(5,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Soft Skills/Behavior Traits
CREATE TABLE IF NOT EXISTS appraisal_soft_skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight DECIMAL(5,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main Appraisal Record
CREATE TABLE IF NOT EXISTS performance_appraisals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    branch_department VARCHAR(255),
    position VARCHAR(255),
    pf_number VARCHAR(50),
    supervisor_id INTEGER REFERENCES users(id),
    supervisor_designation VARCHAR(255),
    period_type VARCHAR(50) DEFAULT 'Quarterly', -- Quarterly, Annual
    period_year INTEGER NOT NULL,
    period_quarter INTEGER, -- 1, 2, 3, 4
    appraisal_date DATE,
    
    -- Section B: Performance Targets Total
    section_b_total DECIMAL(5,2) DEFAULT 0,
    section_b_weighted_total DECIMAL(5,2) DEFAULT 0,
    
    -- Section C: Soft Skills Total  
    section_c_total DECIMAL(5,2) DEFAULT 0,
    section_c_weighted_total DECIMAL(5,2) DEFAULT 0,
    
    -- Overall Performance (Part E)
    strategic_objectives_score DECIMAL(5,2) DEFAULT 0, -- 70%
    soft_skills_score DECIMAL(5,2) DEFAULT 0, -- 30%
    total_performance_rating DECIMAL(5,2) DEFAULT 0,
    
    -- Status and workflow
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted, Supervisor_Review, HOD_Review, HR_Review, CEO_Approved, Finalized
    
    -- Comments from various stakeholders
    appraisee_comments TEXT,
    appraiser_comments TEXT,
    hod_comments TEXT,
    hr_comments TEXT,
    ceo_comments TEXT,
    
    -- Signatures
    appraisee_signature_date DATE,
    appraiser_signature_date DATE,
    hod_signature_date DATE,
    hr_signature_date DATE,
    ceo_signature_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Monthly KRA Scores (for tracking month by month)
CREATE TABLE IF NOT EXISTS appraisal_kra_scores (
    id SERIAL PRIMARY KEY,
    appraisal_id INTEGER REFERENCES performance_appraisals(id) ON DELETE CASCADE,
    kra_id INTEGER REFERENCES appraisal_kras(id),
    target TEXT,
    actual_achievement TEXT,
    
    -- Monthly targets and actuals
    jan_target DECIMAL(15,2),
    jan_actual DECIMAL(15,2),
    jan_percent DECIMAL(5,2),
    
    feb_target DECIMAL(15,2),
    feb_actual DECIMAL(15,2),
    feb_percent DECIMAL(5,2),
    
    mar_target DECIMAL(15,2),
    mar_actual DECIMAL(15,2),
    mar_percent DECIMAL(5,2),
    
    apr_target DECIMAL(15,2),
    apr_actual DECIMAL(15,2),
    apr_percent DECIMAL(5,2),
    
    may_target DECIMAL(15,2),
    may_actual DECIMAL(15,2),
    may_percent DECIMAL(5,2),
    
    jun_target DECIMAL(15,2),
    jun_actual DECIMAL(15,2),
    jun_percent DECIMAL(5,2),
    
    -- Aggregates
    target_total DECIMAL(15,2),
    actual_total DECIMAL(15,2),
    percent_achieved DECIMAL(5,2),
    weighted_average DECIMAL(5,2),
    
    supervisor_comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Soft Skills Scores
CREATE TABLE IF NOT EXISTS appraisal_soft_skill_scores (
    id SERIAL PRIMARY KEY,
    appraisal_id INTEGER REFERENCES performance_appraisals(id) ON DELETE CASCADE,
    soft_skill_id INTEGER REFERENCES appraisal_soft_skills(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    weighted_score DECIMAL(5,2),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses Attended (Part F Section 1)
CREATE TABLE IF NOT EXISTS appraisal_courses (
    id SERIAL PRIMARY KEY,
    appraisal_id INTEGER REFERENCES performance_appraisals(id) ON DELETE CASCADE,
    course_name VARCHAR(255),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Development Plans (Part F Section 2)
CREATE TABLE IF NOT EXISTS appraisal_development_plans (
    id SERIAL PRIMARY KEY,
    appraisal_id INTEGER REFERENCES performance_appraisals(id) ON DELETE CASCADE,
    plan_description TEXT,
    manager_actions TEXT,
    target_completion_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default pillars
INSERT INTO appraisal_pillars (name, description, sort_order) VALUES
('MEMBERSHIP', 'Member recruitment and retention', 1),
('RETENTION AND CUSTOMER SATISFACTION', 'Customer satisfaction and dormant account activation', 2),
('FINANCE', 'Deposits, online platforms, and branch cost management', 3),
('CREDIT', 'Loan book growth, arrears recovery, and PAR management', 4),
('OPERATIONS', 'Agent recruitment, branch management, staff management', 5),
('AUDIT AND RISK', 'Compliance with policies and risk management', 6),
('HR', 'Innovation and creativity', 7)
ON CONFLICT DO NOTHING;

-- Insert default soft skills
INSERT INTO appraisal_soft_skills (name, description, weight, sort_order) VALUES
('Diligence/Attitude to work (Self-Motivation)', 'Consider the willingness, enthusiasm and determination to see tasks completed. Assumes responsibility for successfully accomplishing work objectives and delivering results; setting high standards of performance for self', 8, 1),
('Customer awareness (internal and external)', 'Awareness of the impact that the work and job holder''s general attitude makes to customers. Makes customers and their needs a primary focus of one''s actions; develops and sustains productive customer relationships, takes action to meet customer needs and concerns and ensures timely feedback to enhance satisfaction.', 8, 2),
('Teamwork', 'To what extent does he/she contribute to team effort and does he/she participate in team activities, support other team members towards completion of goals/tasks. Consider ability to relate well with colleagues and superiors as internal customers and the general membership. Aligns personal work and performance with the broader team to achieve mutual outcomes.', 8, 3),
('Integrity', 'Honest and having strong moral principles. A person with integrity behaves ethically and cannot be compromised, displays and promotes conduct and behaviors consistent with the Sacco established standards.', 6, 4)
ON CONFLICT DO NOTHING;
