-- Performance Sections Migration
-- This creates tables to store the new performance section scores

-- Create performance section scores table (replaces/supplements kra_scores)
CREATE TABLE IF NOT EXISTS performance_section_scores (
    id SERIAL PRIMARY KEY,
    appraisal_id INTEGER NOT NULL REFERENCES performance_appraisals(id) ON DELETE CASCADE,
    section_name VARCHAR(255) NOT NULL,
    pillar TEXT,
    key_result_area TEXT,
    target_description TEXT,
    jan_target NUMERIC(15,2) DEFAULT 0,
    jan_actual NUMERIC(15,2) DEFAULT 0,
    jan_percent NUMERIC(10,2) DEFAULT 0,
    feb_target NUMERIC(15,2) DEFAULT 0,
    feb_actual NUMERIC(15,2) DEFAULT 0,
    feb_percent NUMERIC(10,2) DEFAULT 0,
    mar_target NUMERIC(15,2) DEFAULT 0,
    mar_actual NUMERIC(15,2) DEFAULT 0,
    mar_percent NUMERIC(10,2) DEFAULT 0,
    apr_target NUMERIC(15,2) DEFAULT 0,
    apr_actual NUMERIC(15,2) DEFAULT 0,
    apr_percent NUMERIC(10,2) DEFAULT 0,
    may_target NUMERIC(15,2) DEFAULT 0,
    may_actual NUMERIC(15,2) DEFAULT 0,
    may_percent NUMERIC(10,2) DEFAULT 0,
    jun_target NUMERIC(15,2) DEFAULT 0,
    jun_actual NUMERIC(15,2) DEFAULT 0,
    jun_percent NUMERIC(10,2) DEFAULT 0,
    jul_target NUMERIC(15,2) DEFAULT 0,
    jul_actual NUMERIC(15,2) DEFAULT 0,
    jul_percent NUMERIC(10,2) DEFAULT 0,
    aug_target NUMERIC(15,2) DEFAULT 0,
    aug_actual NUMERIC(15,2) DEFAULT 0,
    aug_percent NUMERIC(10,2) DEFAULT 0,
    sep_target NUMERIC(15,2) DEFAULT 0,
    sep_actual NUMERIC(15,2) DEFAULT 0,
    sep_percent NUMERIC(10,2) DEFAULT 0,
    oct_target NUMERIC(15,2) DEFAULT 0,
    oct_actual NUMERIC(15,2) DEFAULT 0,
    oct_percent NUMERIC(10,2) DEFAULT 0,
    nov_target NUMERIC(15,2) DEFAULT 0,
    nov_actual NUMERIC(15,2) DEFAULT 0,
    nov_percent NUMERIC(10,2) DEFAULT 0,
    dec_target NUMERIC(15,2) DEFAULT 0,
    dec_actual NUMERIC(15,2) DEFAULT 0,
    dec_percent NUMERIC(10,2) DEFAULT 0,
    target_total NUMERIC(15,2) DEFAULT 0,
    actual_total NUMERIC(15,2) DEFAULT 0,
    percent_achieved NUMERIC(10,2) DEFAULT 0,
    weight INTEGER DEFAULT 0,
    actual_rating NUMERIC(10,2) DEFAULT 0,
    weighted_average NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_performance_section_scores_appraisal 
ON performance_section_scores(appraisal_id);

CREATE INDEX IF NOT EXISTS idx_performance_section_scores_section 
ON performance_section_scores(section_name);

-- Add period_semi column to performance_appraisals if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'performance_appraisals' 
                   AND column_name = 'period_semi') THEN
        ALTER TABLE performance_appraisals ADD COLUMN period_semi INTEGER;
    END IF;
END $$;

-- Add performance_sections_data JSONB column for storing complete section state
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'performance_appraisals' 
                   AND column_name = 'performance_sections_data') THEN
        ALTER TABLE performance_appraisals ADD COLUMN performance_sections_data JSONB;
    END IF;
END $$;

-- Update period_type check constraint if exists
DO $$
BEGIN
    ALTER TABLE performance_appraisals DROP CONSTRAINT IF EXISTS check_period_type;
    ALTER TABLE performance_appraisals ADD CONSTRAINT check_period_type 
        CHECK (period_type IN ('Quarterly', 'Semi-annually', 'Annual', 'Annually'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Create soft skill scores table if not exists
CREATE TABLE IF NOT EXISTS appraisal_soft_skill_scores (
    id SERIAL PRIMARY KEY,
    appraisal_id INTEGER NOT NULL REFERENCES performance_appraisals(id) ON DELETE CASCADE,
    soft_skill_id INTEGER REFERENCES appraisal_soft_skills(id),
    skill_name VARCHAR(255),
    rating NUMERIC(5,2),
    weight NUMERIC(5,2),
    weighted_score NUMERIC(10,2),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create courses table if not exists
CREATE TABLE IF NOT EXISTS appraisal_courses (
    id SERIAL PRIMARY KEY,
    appraisal_id INTEGER NOT NULL REFERENCES performance_appraisals(id) ON DELETE CASCADE,
    course_name VARCHAR(500),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create development plans table if not exists
CREATE TABLE IF NOT EXISTS appraisal_development_plans (
    id SERIAL PRIMARY KEY,
    appraisal_id INTEGER NOT NULL REFERENCES performance_appraisals(id) ON DELETE CASCADE,
    plan_description TEXT,
    manager_actions TEXT,
    target_completion_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT 'Performance sections migration completed successfully' as status;
