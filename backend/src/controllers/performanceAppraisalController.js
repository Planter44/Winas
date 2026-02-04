const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

const normalizeRoleName = (role) => String(role || '').trim();
const HR_ROLE_NAMES = new Set(['HR', 'HR Manager', 'Human Resource', 'Human Resources']);

const isPrivilegedRole = (user) => {
    const role = normalizeRoleName(user?.role_name);
    return role === 'CEO' || role === 'HR' || role === 'Super Admin';
};

const getUserMeta = async (client, userId) => {
    if (!userId) return null;
    const res = await client.query(
        `SELECT id, department_id, supervisor_id
         FROM users
         WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
    );
    return res.rows[0] || null;
};

const getUserRoleName = async (client, userId) => {
    if (!userId) return null;
    const res = await client.query(
        `SELECT r.name as role_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [userId]
    );
    return res.rows[0]?.role_name || null;
};

const canAccessAppraisalForUserId = async (client, currentUser, appraisalUserId) => {
    const role = (currentUser?.role_name || '').trim();
    if (!appraisalUserId) return false;

    if (isPrivilegedRole(currentUser)) return true;

    if (role === 'Staff') {
        return currentUser.id === appraisalUserId;
    }

    const meta = await getUserMeta(client, appraisalUserId);
    if (!meta) return false;

    if (role === 'HOD') {
        return currentUser.department_id && meta.department_id === currentUser.department_id;
    }

    if (role === 'Supervisor') {
        return meta.supervisor_id === currentUser.id || currentUser.id === appraisalUserId;
    }

    return false;
};

const canCreateForTargetUserId = async (client, currentUser, targetUserId) => {
    const role = (currentUser?.role_name || '').trim();
    if (!targetUserId) return false;

    if (role === 'Staff') return false;
    if (isPrivilegedRole(currentUser)) return true;

    const meta = await getUserMeta(client, targetUserId);
    if (!meta) return false;

    if (role === 'HOD') {
        return currentUser.department_id && meta.department_id === currentUser.department_id;
    }

    if (role === 'Supervisor') {
        return meta.supervisor_id === currentUser.id;
    }

    return false;
};

const resolveSupervisorStaffId = async (client, userId, fallbackStaffId) => {
    if (!userId) return fallbackStaffId || null;

    const meta = await client.query(
        `SELECT u.supervisor_id, u.department_id, r.name as role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [userId]
    );

    const supervisorUserId = meta.rows[0]?.supervisor_id || null;
    const deptId = meta.rows[0]?.department_id || null;
    const roleName = normalizeRoleName(meta.rows[0]?.role_name);
    const roleNeedsCeo = roleName === 'HOD' || HR_ROLE_NAMES.has(roleName);

    // Follow leave approver rule: for Supervisors, their supervisor/approver is the HOD of their department.
    if (roleName.toLowerCase() === 'supervisor' && deptId) {
        const hodUser = await client.query(
            `SELECT u.id
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.department_id = $1
               AND r.name = 'HOD'
               AND u.deleted_at IS NULL
             ORDER BY u.id ASC
             LIMIT 1`,
            [deptId]
        );
        const hodUserId = hodUser.rows[0]?.id || null;
        if (hodUserId) return hodUserId;
    }

    const getCeoUserId = async () => {
        const ceoUser = await client.query(
            `SELECT u.id
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.deleted_at IS NULL
               AND (r.name ILIKE 'CEO%' OR r.name ILIKE '%CEO%' OR r.name ILIKE 'Chief Executive%')
             ORDER BY u.id ASC
             LIMIT 1`
        );
        return ceoUser.rows[0]?.id || null;
    };

    if (roleNeedsCeo) {
        const ceoUserId = await getCeoUserId();
        return ceoUserId || fallbackStaffId || supervisorUserId;
    }

    return supervisorUserId || fallbackStaffId || null;
};

const deriveNameFromEmail = (email, userId) => {
    const localPart = String(email || '').split('@')[0] || '';
    const cleaned = localPart.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
    const parts = cleaned.split(' ').filter(Boolean);
    const capitalize = (value) => value
        ? value.charAt(0).toUpperCase() + value.slice(1)
        : '';

    if (parts.length >= 2) {
        return {
            firstName: capitalize(parts[0]),
            lastName: capitalize(parts.slice(1).join(' '))
        };
    }

    if (parts.length === 1) {
        return {
            firstName: capitalize(parts[0]),
            lastName: 'User'
        };
    }

    return {
        firstName: 'Staff',
        lastName: userId ? `User${userId}` : 'User'
    };
};

const ensureStaffProfileForUser = async (client, userId) => {
    if (!userId) return null;

    try {
        const existing = await client.query(
            'SELECT id FROM staff_profiles WHERE user_id = $1',
            [userId]
        );

        if (existing.rows[0]?.id) {
            return existing.rows[0].id;
        }

        const userRes = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
        const email = userRes.rows[0]?.email || '';
        const { firstName, lastName } = deriveNameFromEmail(email, userId);

        let hasEmployeeNumber = false;
        let requiresEmployeeNumber = false;
        let hasJobTitle = false;
        let requiresJobTitle = false;

        try {
            const columnRes = await client.query(
                `SELECT column_name, is_nullable
                 FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'staff_profiles'`
            );
            const columnMap = new Map(columnRes.rows.map(row => [row.column_name, row.is_nullable]));
            hasEmployeeNumber = columnMap.has('employee_number');
            requiresEmployeeNumber = columnMap.get('employee_number') === 'NO';
            hasJobTitle = columnMap.has('job_title');
            requiresJobTitle = columnMap.get('job_title') === 'NO';
        } catch (e) {
            // ignore column metadata failures
        }

        const columns = ['user_id', 'first_name', 'last_name'];
        const values = [userId, firstName || 'Staff', lastName || 'User'];

        if (hasEmployeeNumber) {
            columns.push('employee_number');
            const employeeNumberValue = requiresEmployeeNumber
                ? `AUTO-${userId}-${Date.now()}`
                : null;
            values.push(employeeNumberValue);
        }

        if (hasJobTitle) {
            columns.push('job_title');
            const jobTitleValue = requiresJobTitle ? 'Staff' : null;
            values.push(jobTitleValue);
        }

        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

        await client.query(
            `INSERT INTO staff_profiles (${columns.join(', ')})
             VALUES (${placeholders})
             ON CONFLICT (user_id) DO NOTHING`,
            values
        );

        const created = await client.query(
            'SELECT id FROM staff_profiles WHERE user_id = $1',
            [userId]
        );

        return created.rows[0]?.id || null;
    } catch (error) {
        return null;
    }
};

const resolveStaffIdForAppraisal = async (client, userId) => {
    if (!userId) return null;

    let foreignTable = null;
    try {
        const fkRes = await client.query(
            `SELECT ccu.table_name AS foreign_table_name
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
             JOIN information_schema.constraint_column_usage ccu
               ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
             WHERE tc.table_schema = 'public'
               AND tc.table_name = 'performance_appraisals'
               AND tc.constraint_type = 'FOREIGN KEY'
               AND kcu.column_name = 'staff_id'
             LIMIT 1`
        );
        foreignTable = fkRes.rows[0]?.foreign_table_name || null;
    } catch (error) {
        foreignTable = null;
    }

    const resolveStaffProfileId = async () => {
        try {
            const staffRes = await client.query(
                `SELECT id FROM staff_profiles WHERE user_id = $1`,
                [userId]
            );
            if (staffRes.rows[0]?.id) {
                return staffRes.rows[0].id;
            }

            return await ensureStaffProfileForUser(client, userId);
        } catch (error) {
            return null;
        }
    };

    const resolveStaffIdFromStaffTable = async () => {
        try {
            const columnsRes = await client.query(
                `SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'staff'`
            );
            const columns = new Set(columnsRes.rows.map(r => r.column_name));
            if (columns.size === 0) return null;

            const userRes = await client.query(
                `SELECT email FROM users WHERE id = $1`,
                [userId]
            );
            const userEmail = userRes.rows[0]?.email || null;
            const normalizedEmail = userEmail ? String(userEmail).toLowerCase() : null;

            let staffProfileId = null;
            let employeeNumber = null;
            const profileRes = await client.query(
                `SELECT id, employee_number FROM staff_profiles WHERE user_id = $1`,
                [userId]
            );
            staffProfileId = profileRes.rows[0]?.id || null;
            employeeNumber = profileRes.rows[0]?.employee_number || null;

            const tryLookup = async (column, value) => {
                if (!value) return null;
                const res = await client.query(
                    `SELECT id FROM staff WHERE ${column} = $1 LIMIT 1`,
                    [value]
                );
                return res.rows[0]?.id || null;
            };

            if (columns.has('user_id')) {
                const id = await tryLookup('user_id', userId);
                if (id) return id;
            }
            if (columns.has('staff_profile_id')) {
                const id = await tryLookup('staff_profile_id', staffProfileId);
                if (id) return id;
            }

            const employeeColumns = ['employee_number', 'employee_no', 'staff_no', 'staff_number', 'pf_number', 'pf_no'];
            for (const col of employeeColumns) {
                if (columns.has(col)) {
                    const id = await tryLookup(col, employeeNumber);
                    if (id) return id;
                }
            }

            const emailColumns = ['email', 'work_email', 'official_email'];
            for (const col of emailColumns) {
                if (columns.has(col)) {
                    const id = await tryLookup(col, normalizedEmail);
                    if (id) return id;
                }
            }
        } catch (error) {
            return null;
        }

        return null;
    };

    if (foreignTable === 'users') {
        return userId;
    }

    if (foreignTable === 'staff_profiles') {
        return await resolveStaffProfileId();
    }

    if (foreignTable === 'staff') {
        return await resolveStaffIdFromStaffTable();
    }

    const staffId = await resolveStaffProfileId();
    return staffId || userId;
};

const getPerformanceSectionScoreColumns = async (client) => {
    const colsResult = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'performance_section_scores'`
    );
    return new Set(colsResult.rows.map(r => r.column_name));
};

const ensurePerformanceAppraisalSchema = async (client) => {
    await client.query(
        `ALTER TABLE performance_appraisals
         ADD COLUMN IF NOT EXISTS performance_sections_data JSONB`
    );

    await client.query(
        `CREATE TABLE IF NOT EXISTS performance_section_scores (
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
        )`
    );
    await client.query(
        `CREATE INDEX IF NOT EXISTS idx_performance_section_scores_appraisal
         ON performance_section_scores(appraisal_id)`
    );
    await client.query(
        `CREATE INDEX IF NOT EXISTS idx_performance_section_scores_section
         ON performance_section_scores(section_name)`
    );

    await client.query(
        `CREATE TABLE IF NOT EXISTS appraisal_soft_skill_scores (
            id SERIAL PRIMARY KEY,
            appraisal_id INTEGER NOT NULL REFERENCES performance_appraisals(id) ON DELETE CASCADE,
            soft_skill_id INTEGER REFERENCES appraisal_soft_skills(id),
            rating NUMERIC(10,2),
            weighted_score NUMERIC(10,2),
            comments TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
    await client.query(
        `ALTER TABLE appraisal_soft_skill_scores
         DROP CONSTRAINT IF EXISTS appraisal_soft_skill_scores_rating_check`
    );
    const ratingType = await client.query(
        `SELECT data_type
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'appraisal_soft_skill_scores'
           AND column_name = 'rating'
         LIMIT 1`
    );
    if ((ratingType.rows[0]?.data_type || '').toLowerCase() === 'integer') {
        await client.query(
            `ALTER TABLE appraisal_soft_skill_scores
             ALTER COLUMN rating TYPE NUMERIC(10,2)
             USING rating::numeric`
        );
    }
};

const insertPerformanceSectionScoreRow = async ({
    client,
    columns,
    appraisalId,
    sectionName,
    row
}) => {
    if (!columns || columns.size === 0) return;
    if (!columns.has('appraisal_id') || !columns.has('section_name')) return;

    const toNumberOrNull = (v) => {
        if (v === undefined || v === null) return null;
        if (typeof v === 'string' && v.trim() === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const toIntOrNull = (v) => {
        if (v === undefined || v === null) return null;
        if (typeof v === 'string' && v.trim() === '') return null;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
    };

    const targetCol = columns.has('target_description') ? 'target_description' : (columns.has('target') ? 'target' : null);

    const mappings = [
        { col: 'pillar', get: r => r.pillar || null },
        { col: 'key_result_area', get: r => r.keyResultArea || r.key_result_area || null },
        targetCol ? { col: targetCol, get: r => r.target || null } : null,
        { col: 'target_total', get: r => toNumberOrNull(r.targetTotal ?? r.target_total) },
        { col: 'actual_total', get: r => toNumberOrNull(r.actualTotal ?? r.actual_total) },
        { col: 'percent_achieved', get: r => toNumberOrNull(r.percentAchieved ?? r.percent_achieved) },
        { col: 'weight', get: r => toIntOrNull(r.weight) },
        { col: 'actual_rating', get: r => toNumberOrNull(r.actualRating ?? r.actual_rating) },
        { col: 'weighted_average', get: r => toNumberOrNull(r.weightedAverage ?? r.weighted_average) }
    ].filter(Boolean);

    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const getMonth = (prefix, type) => {
        const map = {
            target: `${prefix}Target`,
            actual: `${prefix}Actual`,
            percent: `${prefix}Percent`
        };
        return row?.[map[type]] ?? null;
    };

    const cols = ['appraisal_id', 'section_name'];
    const values = [appraisalId, sectionName];
    let p = 3;

    for (const m of mappings) {
        if (!m?.col) continue;
        if (!columns.has(m.col)) continue;
        cols.push(m.col);
        values.push(m.get(row));
        p++;
    }

    for (const month of monthKeys) {
        const tCol = `${month}_target`;
        const aCol = `${month}_actual`;
        const pCol = `${month}_percent`;

        if (columns.has(tCol)) {
            cols.push(tCol);
            values.push(toNumberOrNull(getMonth(month, 'target')));
        }
        if (columns.has(aCol)) {
            cols.push(aCol);
            values.push(toNumberOrNull(getMonth(month, 'actual')));
        }
        if (columns.has(pCol)) {
            cols.push(pCol);
            values.push(toNumberOrNull(getMonth(month, 'percent')));
        }
    }

    const placeholders = values.map((_, idx) => `$${idx + 1}`);
    await client.query(
        `INSERT INTO performance_section_scores (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
    );
};

const getSoftSkillWeightFromRating = (rating) => {
    const value = parseFloat(rating) || 0;
    if (value <= 70) return 1;
    if (value <= 80) return 2;
    if (value <= 90) return 3;
    if (value <= 100) return 4;
    if (value <= 110) return 5;
    return 6;
};

const computeSectionBTotal = ({ kraScores, performanceSections, fallback }) => {
    if (kraScores && Array.isArray(kraScores) && kraScores.length > 0) {
        const totals = kraScores.reduce(
            (acc, s) => {
                acc.totalWeight += parseFloat(s?.weight) || 0;
                acc.totalWeightedAverage += parseFloat(s?.weightedAverage ?? s?.weighted_average) || 0;
                return acc;
            },
            { totalWeight: 0, totalWeightedAverage: 0 }
        );

        const base = totals.totalWeight > 0 ? (totals.totalWeightedAverage / totals.totalWeight) : 0;
        return Math.round(base * 0.7);
    }

    if (performanceSections && Array.isArray(performanceSections) && performanceSections.length > 0) {
        const totals = performanceSections.reduce(
            (acc, section) => {
                const rows = Array.isArray(section?.rows) ? section.rows : [];
                const subtotalWeight = (section?.subtotalWeight !== undefined && section?.subtotalWeight !== null)
                    ? (parseFloat(section.subtotalWeight) || 0)
                    : rows.reduce((sum, r) => sum + (parseFloat(r?.weight) || 0), 0);
                const subtotalWeightedAverage = (section?.subtotalWeightedAverage !== undefined && section?.subtotalWeightedAverage !== null)
                    ? (parseFloat(section.subtotalWeightedAverage) || 0)
                    : rows.reduce((sum, r) => sum + (parseFloat(r?.weightedAverage) || 0), 0);

                acc.totalWeight += subtotalWeight;
                acc.totalWeightedAverage += subtotalWeightedAverage;
                return acc;
            },
            { totalWeight: 0, totalWeightedAverage: 0 }
        );

        const base = totals.totalWeight > 0 ? (totals.totalWeightedAverage / totals.totalWeight) : 0;
        return Math.round(base * 0.7);
    }

    const fb = parseFloat(fallback);
    return Number.isFinite(fb) ? fb : 0;
};

const computeSectionCTotal = ({ softSkillScores, fallback }) => {
    if (softSkillScores && Array.isArray(softSkillScores) && softSkillScores.length > 0) {
        const totals = softSkillScores.reduce(
            (acc, s) => {
                const rating = parseFloat(s?.rating) || 0;
                const weight = getSoftSkillWeightFromRating(rating);
                const weightedScore = weight * rating;
                acc.totalWeight += weight;
                acc.totalWeightedScore += weightedScore;
                return acc;
            },
            { totalWeight: 0, totalWeightedScore: 0 }
        );

        const base = totals.totalWeight > 0 ? (totals.totalWeightedScore / totals.totalWeight) : 0;
        return Math.round(base * 0.3);
    }

    const fb = parseFloat(fallback);
    return Number.isFinite(fb) ? fb : 0;
};

const normalizeCommentText = (value) => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value.trim();
    return String(value).trim();
};

const hasNonEmptyComment = (value) => normalizeCommentText(value).length > 0;

const toPositiveNumber = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n > 0 ? n : null;
};

const hasAnyPositiveNumberField = (obj, keys) => {
    if (!obj) return false;
    return keys.some((k) => toPositiveNumber(obj?.[k]) !== null);
};

const hasSectionBMeaningfulInput = ({ kraScores, performanceSections, sectionBTotal }) => {
    const sectionBTotalNum = Number(sectionBTotal);
    if (Number.isFinite(sectionBTotalNum) && sectionBTotalNum > 0) return true;

    const kraKeys = [
        'targetTotal',
        'target_total',
        'actualTotal',
        'actual_total',
        'percentAchieved',
        'percent_achieved',
        'weightedAverage',
        'weighted_average',
        'janTarget',
        'jan_target',
        'febTarget',
        'feb_target',
        'marTarget',
        'mar_target',
        'aprTarget',
        'apr_target',
        'mayTarget',
        'may_target',
        'junTarget',
        'jun_target',
        'julTarget',
        'jul_target',
        'augTarget',
        'aug_target',
        'sepTarget',
        'sep_target',
        'octTarget',
        'oct_target',
        'novTarget',
        'nov_target',
        'decTarget',
        'dec_target',
        'janActual',
        'jan_actual',
        'febActual',
        'feb_actual',
        'marActual',
        'mar_actual',
        'aprActual',
        'apr_actual',
        'mayActual',
        'may_actual',
        'junActual',
        'jun_actual',
        'julActual',
        'jul_actual',
        'augActual',
        'aug_actual',
        'sepActual',
        'sep_actual',
        'octActual',
        'oct_actual',
        'novActual',
        'nov_actual',
        'decActual',
        'dec_actual'
    ];

    if (Array.isArray(kraScores) && kraScores.some(s => hasAnyPositiveNumberField(s, kraKeys))) {
        return true;
    }

    if (Array.isArray(performanceSections)) {
        for (const sec of performanceSections) {
            const rows = Array.isArray(sec?.rows) ? sec.rows : [];
            if (rows.some(r => hasAnyPositiveNumberField(r, kraKeys))) return true;
        }
    }

    return false;
};

const hasSectionCMeaningfulInput = ({ softSkillScores, sectionCTotal }) => {
    const sectionCTotalNum = Number(sectionCTotal);
    if (Number.isFinite(sectionCTotalNum) && sectionCTotalNum > 0) return true;

    if (Array.isArray(softSkillScores) && softSkillScores.some(s => toPositiveNumber(s?.rating) !== null)) {
        return true;
    }

    return false;
};

const STATUS_RANK = {
    Draft: 0,
    Submitted: 1,
    Supervisor_Review: 2,
    HOD_Review: 3,
    HR_Review: 4,
    CEO_Approved: 5,
    Finalized: 6
};

const getSignatureDateUpdateFragments = ({ derivedStatus, columns }) => {
    const rank = STATUS_RANK[derivedStatus] ?? 0;
    const fragments = [];

    if (rank >= STATUS_RANK.Submitted && columns.has('appraisee_signature_date')) {
        fragments.push(`appraisee_signature_date = COALESCE(appraisee_signature_date, CURRENT_DATE)`);
    }
    if (rank >= STATUS_RANK.Supervisor_Review && columns.has('appraiser_signature_date')) {
        fragments.push(`appraiser_signature_date = COALESCE(appraiser_signature_date, CURRENT_DATE)`);
    }
    if (rank >= STATUS_RANK.HOD_Review && columns.has('hod_signature_date')) {
        fragments.push(`hod_signature_date = COALESCE(hod_signature_date, CURRENT_DATE)`);
    }
    if (rank >= STATUS_RANK.HR_Review && columns.has('hr_signature_date')) {
        fragments.push(`hr_signature_date = COALESCE(hr_signature_date, CURRENT_DATE)`);
    }
    if (rank >= STATUS_RANK.CEO_Approved && columns.has('ceo_signature_date')) {
        fragments.push(`ceo_signature_date = COALESCE(ceo_signature_date, CURRENT_DATE)`);
    }

    return fragments;
};

const derivePerformanceAppraisalStatusFromCompleteness = ({
    hasSectionB,
    hasSectionC,
    appraiserComments,
    hodComments,
    hrComments,
    ceoComments
}) => {
    if (!hasSectionB && !hasSectionC) return 'Draft';
    if (!hasSectionB || !hasSectionC) return 'Draft';

    if (!hasNonEmptyComment(appraiserComments)) return 'Submitted';
    if (!hasNonEmptyComment(hodComments)) return 'Supervisor_Review';
    if (!hasNonEmptyComment(hrComments)) return 'HOD_Review';
    if (!hasNonEmptyComment(ceoComments)) return 'HR_Review';

    return 'Finalized';
};

const derivePerformanceAppraisalStatus = ({
    kraScores,
    performanceSections,
    sectionBTotal,
    softSkillScores,
    sectionCTotal,
    appraiserComments,
    hodComments,
    hrComments,
    ceoComments
}) => {
    const hasSectionB = hasSectionBMeaningfulInput({ kraScores, performanceSections, sectionBTotal });
    const hasSectionC = hasSectionCMeaningfulInput({ softSkillScores, sectionCTotal });

    return derivePerformanceAppraisalStatusFromCompleteness({
        hasSectionB,
        hasSectionC,
        appraiserComments,
        hodComments,
        hrComments,
        ceoComments
    });
};

// Get all pillars with their KRAs
const getPillarsWithKRAs = async (req, res) => {
    try {
        const pillars = await db.query(
            `SELECT * FROM appraisal_pillars WHERE is_active = true ORDER BY sort_order`
        );

        const kras = await db.query(
            `SELECT * FROM appraisal_kras WHERE is_active = true ORDER BY pillar_id, sort_order`
        );

        const result = pillars.rows.map(pillar => ({
            ...pillar,
            kras: kras.rows.filter(kra => kra.pillar_id === pillar.id)
        }));

        res.json(result);
    } catch (error) {
        console.error('Get pillars error:', error);
        res.status(500).json({ error: 'Failed to fetch pillars' });
    }
};

// Get soft skills
const getSoftSkills = async (req, res) => {
    try {
        const result = await db.query(
            `WITH ranked AS (
                SELECT *,
                       ROW_NUMBER() OVER (
                           PARTITION BY LOWER(name), LOWER(COALESCE(description, ''))
                           ORDER BY sort_order NULLS LAST, id
                       ) AS rn
                FROM appraisal_soft_skills
                WHERE is_active = true
            )
            SELECT id, name, description, weight, sort_order, is_active, created_at
            FROM ranked
            WHERE rn = 1
            ORDER BY sort_order NULLS LAST, id`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get soft skills error:', error);
        res.status(500).json({ error: 'Failed to fetch soft skills' });
    }
};

// Create a new performance appraisal
const createAppraisal = async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        const creatorId = req.user.id;
        const currentUser = req.user;
        const {
            userId,
            branchDepartment,
            position,
            pfNumber,
            supervisorDesignation,
            periodType,
            periodYear,
            periodQuarter,
            periodSemi,
            appraisalDate,
            performanceSections,
            kraScores,
            sectionBTotal,
            softSkillScores,
            sectionCTotal,
            overallRating,
            courses,
            developmentPlans,
            appraiseeComments,
            appraiserComments,
            hodComments,
            hrComments,
            ceoComments
        } = req.body;

        const normalizedUserId = (userId === '' || userId === undefined || userId === null) ? null : userId;

        // Require explicit target user selection (prevents accidental self-creation)
        const targetUserId = normalizedUserId;
        
        if (!targetUserId || !periodYear) {
            return res.status(400).json({ error: 'User ID and year are required' });
        }

        if (String(targetUserId) === String(creatorId) && !(currentUser.role_name === 'CEO' || currentUser.role_name === 'Super Admin')) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        const allowedToCreate = await canCreateForTargetUserId(client, currentUser, targetUserId);
        if (!allowedToCreate) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        await client.query('BEGIN');

        await ensurePerformanceAppraisalSchema(client);

        let supervisorId = await resolveSupervisorStaffId(client, targetUserId, null);
        if (!supervisorId && currentUser?.role_name === 'Supervisor') {
            supervisorId = currentUser.id;
        }

        const allowedPeriodTypes = ['Quarterly', 'Semi-annually', 'Annual', 'Annually'];
        const normalizedPeriodType = allowedPeriodTypes.includes(periodType) ? periodType : 'Annual';
        const normalizedQuarter = normalizedPeriodType === 'Quarterly' ? (parseInt(periodQuarter) || null) : null;
        const periodYearNum = parseInt(periodYear);

        if (normalizedPeriodType === 'Quarterly' && !(normalizedQuarter >= 1 && normalizedQuarter <= 4)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Quarter is required for Quarterly appraisals' });
        }

        const createColumnsResult = await client.query(
            `SELECT column_name, is_nullable
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'performance_appraisals'`
        );
        const createAppraisalColumns = new Set(createColumnsResult.rows.map(r => r.column_name));
        const createColumnMeta = new Map(createColumnsResult.rows.map(r => [r.column_name, r]));
        const staffIdNullable = createColumnMeta.get('staff_id')?.is_nullable === 'YES';

        const sectionBTotalNum = computeSectionBTotal({ kraScores, performanceSections, fallback: sectionBTotal });
        const sectionCTotalNum = computeSectionCTotal({ softSkillScores, fallback: sectionCTotal });

        const resolvedStaffId = createAppraisalColumns.has('staff_id')
            ? await resolveStaffIdForAppraisal(client, targetUserId)
            : null;

        if (createAppraisalColumns.has('staff_id') && !resolvedStaffId && !staffIdNullable) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Staff profile is required for this appraisal. Please create the staff profile first.'
            });
        }

        let overallScore = Math.round(sectionBTotalNum + sectionCTotalNum);
        const incomingOverall = parseFloat(overallRating);
        if (Number.isFinite(incomingOverall) && incomingOverall) {
            overallScore = incomingOverall;
        }

        const periodSemiNum = normalizedPeriodType === 'Semi-annually' ? (parseInt(periodSemi) || 1) : null;

        const existingWhere = ['user_id = $1'];
        const existingParams = [targetUserId];
        let existingParamCount = 2;

        if (createAppraisalColumns.has('period_type')) {
            existingWhere.push(`period_type = $${existingParamCount++}`);
            existingParams.push(normalizedPeriodType);
        }
        if (createAppraisalColumns.has('period_year')) {
            existingWhere.push(`period_year = $${existingParamCount++}`);
            existingParams.push(periodYearNum);
        }
        if (createAppraisalColumns.has('period_quarter')) {
            existingWhere.push(`period_quarter IS NOT DISTINCT FROM $${existingParamCount++}`);
            existingParams.push(normalizedQuarter);
        }
        if (createAppraisalColumns.has('period_semi')) {
            existingWhere.push(`period_semi IS NOT DISTINCT FROM $${existingParamCount++}`);
            existingParams.push(periodSemiNum);
        }

        const existingAny = await client.query(
            createAppraisalColumns.has('deleted_at')
                ? `SELECT id, deleted_at FROM performance_appraisals
                   WHERE ${existingWhere.join(' AND ')}
                   ORDER BY id DESC
                   LIMIT 1`
                : `SELECT id FROM performance_appraisals
                   WHERE ${existingWhere.join(' AND ')}
                   ORDER BY id DESC
                   LIMIT 1`,
            existingParams
        );

        let appraisalId = null;
        if (existingAny.rows.length > 0) {
            const row = existingAny.rows[0];
            const isDeleted = Boolean(createAppraisalColumns.has('deleted_at') && row.deleted_at);
            if (!isDeleted) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Appraisal already exists for this period', existingId: row.id });
            }

            appraisalId = row.id;
            const restoreFields = [];
            const restoreValues = [];
            let restoreParam = 1;

            if (createAppraisalColumns.has('deleted_at')) restoreFields.push('deleted_at = NULL');
            if (createAppraisalColumns.has('status')) {
                restoreFields.push(`status = $${restoreParam++}`);
                restoreValues.push('Draft');
            }
            if (createAppraisalColumns.has('supervisor_id')) {
                restoreFields.push(`supervisor_id = $${restoreParam++}`);
                restoreValues.push(supervisorId);
            }
            if (createAppraisalColumns.has('staff_id')) {
                restoreFields.push(`staff_id = $${restoreParam++}`);
                restoreValues.push(resolvedStaffId);
            }
            if (createAppraisalColumns.has('user_id')) {
                restoreFields.push(`user_id = $${restoreParam++}`);
                restoreValues.push(targetUserId);
            }
            if (createAppraisalColumns.has('period_type')) {
                restoreFields.push(`period_type = $${restoreParam++}`);
                restoreValues.push(normalizedPeriodType);
            }
            if (createAppraisalColumns.has('period_year')) {
                restoreFields.push(`period_year = $${restoreParam++}`);
                restoreValues.push(periodYearNum);
            }
            if (createAppraisalColumns.has('period_quarter')) {
                restoreFields.push(`period_quarter = $${restoreParam++}`);
                restoreValues.push(normalizedQuarter);
            }
            if (createAppraisalColumns.has('period_semi')) {
                restoreFields.push(`period_semi = $${restoreParam++}`);
                restoreValues.push(periodSemiNum);
            }
            if (createAppraisalColumns.has('branch_department')) {
                restoreFields.push(`branch_department = $${restoreParam++}`);
                restoreValues.push(branchDepartment || null);
            }
            if (createAppraisalColumns.has('position')) {
                restoreFields.push(`position = $${restoreParam++}`);
                restoreValues.push(position || null);
            }
            if (createAppraisalColumns.has('pf_number')) {
                restoreFields.push(`pf_number = $${restoreParam++}`);
                restoreValues.push(pfNumber || null);
            }
            if (createAppraisalColumns.has('supervisor_designation')) {
                restoreFields.push(`supervisor_designation = $${restoreParam++}`);
                restoreValues.push(supervisorDesignation || null);
            }
            if (createAppraisalColumns.has('appraisal_date')) {
                restoreFields.push(`appraisal_date = $${restoreParam++}`);
                restoreValues.push(appraisalDate || null);
            }
            if (createAppraisalColumns.has('section_b_total')) {
                restoreFields.push(`section_b_total = $${restoreParam++}`);
                restoreValues.push(sectionBTotalNum);
            }
            if (createAppraisalColumns.has('section_b_weighted_total')) {
                restoreFields.push(`section_b_weighted_total = $${restoreParam++}`);
                restoreValues.push(sectionBTotalNum);
            }
            if (createAppraisalColumns.has('section_c_total')) {
                restoreFields.push(`section_c_total = $${restoreParam++}`);
                restoreValues.push(sectionCTotalNum);
            }
            if (createAppraisalColumns.has('section_c_weighted_total')) {
                restoreFields.push(`section_c_weighted_total = $${restoreParam++}`);
                restoreValues.push(sectionCTotalNum);
            }
            if (createAppraisalColumns.has('strategic_objectives_score')) {
                restoreFields.push(`strategic_objectives_score = $${restoreParam++}`);
                restoreValues.push(sectionBTotalNum);
            }
            if (createAppraisalColumns.has('soft_skills_score')) {
                restoreFields.push(`soft_skills_score = $${restoreParam++}`);
                restoreValues.push(sectionCTotalNum);
            }
            if (createAppraisalColumns.has('overall_score')) {
                restoreFields.push(`overall_score = $${restoreParam++}`);
                restoreValues.push(overallScore);
            }
            if (createAppraisalColumns.has('total_performance_rating')) {
                restoreFields.push(`total_performance_rating = $${restoreParam++}`);
                restoreValues.push(overallScore);
            }
            if (createAppraisalColumns.has('appraisee_comments')) {
                restoreFields.push(`appraisee_comments = $${restoreParam++}`);
                restoreValues.push(appraiseeComments || '');
            }
            if (createAppraisalColumns.has('appraiser_comments')) {
                restoreFields.push(`appraiser_comments = $${restoreParam++}`);
                restoreValues.push(appraiserComments || '');
            }
            if (createAppraisalColumns.has('hod_comments')) {
                restoreFields.push(`hod_comments = $${restoreParam++}`);
                restoreValues.push(hodComments || '');
            }
            if (createAppraisalColumns.has('hr_comments')) {
                restoreFields.push(`hr_comments = $${restoreParam++}`);
                restoreValues.push(hrComments || '');
            }
            if (createAppraisalColumns.has('ceo_comments')) {
                restoreFields.push(`ceo_comments = $${restoreParam++}`);
                restoreValues.push(ceoComments || '');
            }

            restoreValues.push(appraisalId);
            if (restoreFields.length > 0) {
                await client.query(
                    `UPDATE performance_appraisals SET ${restoreFields.join(', ')} WHERE id = $${restoreParam}`,
                    restoreValues
                );
            }

            await client.query('SAVEPOINT sp_restore_cleanup');
            try {
                const cleanupTargets = [
                    'appraisal_courses',
                    'appraisal_development_plans',
                    'appraisal_kra_scores',
                    'appraisal_soft_skill_scores',
                    'performance_section_scores'
                ];
                const existing = await client.query(
                    `SELECT table_name
                     FROM information_schema.tables
                     WHERE table_schema = 'public'
                       AND table_name = ANY($1::text[])`,
                    [cleanupTargets]
                );
                const existingTables = new Set(existing.rows.map(r => r.table_name));

                if (existingTables.has('appraisal_courses')) {
                    await client.query('DELETE FROM appraisal_courses WHERE appraisal_id = $1', [appraisalId]);
                }
                if (existingTables.has('appraisal_development_plans')) {
                    await client.query('DELETE FROM appraisal_development_plans WHERE appraisal_id = $1', [appraisalId]);
                }
                if (existingTables.has('appraisal_kra_scores')) {
                    await client.query('DELETE FROM appraisal_kra_scores WHERE appraisal_id = $1', [appraisalId]);
                }
                if (existingTables.has('appraisal_soft_skill_scores')) {
                    await client.query('DELETE FROM appraisal_soft_skill_scores WHERE appraisal_id = $1', [appraisalId]);
                }
                if (existingTables.has('performance_section_scores')) {
                    await client.query('DELETE FROM performance_section_scores WHERE appraisal_id = $1', [appraisalId]);
                }

                await client.query('RELEASE SAVEPOINT sp_restore_cleanup');
            } catch (e) {
                console.error('Restore cleanup error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_restore_cleanup');
                await client.query('RELEASE SAVEPOINT sp_restore_cleanup');
            }
        }

        // Insert main appraisal record (schema-aware)
        if (!appraisalId) {
            const periodYearNumInsert = parseInt(periodYear) || null;

            const cols = [];
            const values = [];

            if (createAppraisalColumns.has('supervisor_id')) {
                cols.push('supervisor_id');
                values.push(supervisorId);
            }
            if (createAppraisalColumns.has('staff_id')) {
                cols.push('staff_id');
                values.push(resolvedStaffId);
            }
            if (createAppraisalColumns.has('user_id')) {
                cols.push('user_id');
                values.push(targetUserId);
            }
            if (createAppraisalColumns.has('status')) {
                cols.push('status');
                values.push('Draft');
            }
            if (createAppraisalColumns.has('period_type')) {
                cols.push('period_type');
                values.push(normalizedPeriodType);
            }
            if (createAppraisalColumns.has('period_year')) {
                cols.push('period_year');
                values.push(periodYearNumInsert);
            }
            if (createAppraisalColumns.has('period_quarter')) {
                cols.push('period_quarter');
                values.push(normalizedQuarter);
            }
            if (createAppraisalColumns.has('period_semi')) {
                cols.push('period_semi');
                values.push(periodSemiNum);
            }
            if (createAppraisalColumns.has('branch_department')) {
                cols.push('branch_department');
                values.push(branchDepartment || null);
            }
            if (createAppraisalColumns.has('position')) {
                cols.push('position');
                values.push(position || null);
            }
            if (createAppraisalColumns.has('pf_number')) {
                cols.push('pf_number');
                values.push(pfNumber || null);
            }
            if (createAppraisalColumns.has('supervisor_designation')) {
                cols.push('supervisor_designation');
                values.push(supervisorDesignation || null);
            }
            if (createAppraisalColumns.has('appraisal_date')) {
                cols.push('appraisal_date');
                values.push(appraisalDate || null);
            }
            if (createAppraisalColumns.has('section_b_total')) {
                cols.push('section_b_total');
                values.push(sectionBTotalNum);
            }
            if (createAppraisalColumns.has('section_b_weighted_total')) {
                cols.push('section_b_weighted_total');
                values.push(sectionBTotalNum);
            }
            if (createAppraisalColumns.has('section_c_total')) {
                cols.push('section_c_total');
                values.push(sectionCTotalNum);
            }
            if (createAppraisalColumns.has('section_c_weighted_total')) {
                cols.push('section_c_weighted_total');
                values.push(sectionCTotalNum);
            }
            if (createAppraisalColumns.has('strategic_objectives_score')) {
                cols.push('strategic_objectives_score');
                values.push(sectionBTotalNum);
            }
            if (createAppraisalColumns.has('soft_skills_score')) {
                cols.push('soft_skills_score');
                values.push(sectionCTotalNum);
            }
            if (createAppraisalColumns.has('overall_score')) {
                cols.push('overall_score');
                values.push(overallScore);
            }
            if (createAppraisalColumns.has('total_performance_rating')) {
                cols.push('total_performance_rating');
                values.push(overallScore);
            }
            if (createAppraisalColumns.has('appraisee_comments')) {
                cols.push('appraisee_comments');
                values.push(appraiseeComments || '');
            }
            if (createAppraisalColumns.has('appraiser_comments')) {
                cols.push('appraiser_comments');
                values.push(appraiserComments || '');
            }
            if (createAppraisalColumns.has('hod_comments')) {
                cols.push('hod_comments');
                values.push(hodComments || '');
            }
            if (createAppraisalColumns.has('hr_comments')) {
                cols.push('hr_comments');
                values.push(hrComments || '');
            }
            if (createAppraisalColumns.has('ceo_comments')) {
                cols.push('ceo_comments');
                values.push(ceoComments || '');
            }
            if (createAppraisalColumns.has('created_by')) {
                cols.push('created_by');
                values.push(creatorId);
            }

            const placeholders = values.map((_, idx) => `$${idx + 1}`);
            const result = await client.query(
                `INSERT INTO performance_appraisals (${cols.join(', ')})
                 VALUES (${placeholders.join(', ')})
                 RETURNING id`,
                values
            );
            appraisalId = result.rows[0].id;
        }

        if (courses && Array.isArray(courses)) {
            await client.query('SAVEPOINT sp_create_courses');
            try {
                for (const course of courses) {
                    if (course?.name) {
                        await client.query(
                            `INSERT INTO appraisal_courses (appraisal_id, course_name, comments)
                             VALUES ($1, $2, $3)`,
                            [appraisalId, course.name, course.comments || '']
                        );
                    }
                }
                await client.query('RELEASE SAVEPOINT sp_create_courses');
            } catch (e) {
                console.error('Create courses error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_create_courses');
                await client.query('RELEASE SAVEPOINT sp_create_courses');
            }
        }

        if (performanceSections && Array.isArray(performanceSections)) {
            if (createAppraisalColumns.has('performance_sections_data')) {
                await client.query('SAVEPOINT sp_create_perf_sections_json');
                try {
                    await client.query(
                        `UPDATE performance_appraisals SET performance_sections_data = $1 WHERE id = $2`,
                        [JSON.stringify(performanceSections), appraisalId]
                    );
                    await client.query('RELEASE SAVEPOINT sp_create_perf_sections_json');
                } catch (e) {
                    console.error('Create performance sections JSON error:', e);
                    await client.query('ROLLBACK TO SAVEPOINT sp_create_perf_sections_json');
                    await client.query('RELEASE SAVEPOINT sp_create_perf_sections_json');
                    throw e;
                }
            }

            await client.query('SAVEPOINT sp_create_perf_sections_rows');
            try {
                const pssCols = await getPerformanceSectionScoreColumns(client);
                if (pssCols.size > 0) {
                    await client.query('DELETE FROM performance_section_scores WHERE appraisal_id = $1', [appraisalId]);
                }
                for (const section of performanceSections) {
                    const sectionName = section?.name || section?.sectionName || section?.section_name;
                    if (!sectionName) continue;
                    const rows = Array.isArray(section.rows) ? section.rows : [];
                    for (const row of rows) {
                        if (!row) continue;
                        const hasAny = Boolean(row.pillar || row.keyResultArea || row.target);
                        if (!hasAny) continue;

                        await insertPerformanceSectionScoreRow({
                            client,
                            columns: pssCols,
                            appraisalId,
                            sectionName,
                            row
                        });
                    }
                }

                await client.query('RELEASE SAVEPOINT sp_create_perf_sections_rows');
            } catch (e) {
                console.error('Create performance sections rows error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_create_perf_sections_rows');
                await client.query('RELEASE SAVEPOINT sp_create_perf_sections_rows');
                throw e;
            }
        }

        if (softSkillScores && Array.isArray(softSkillScores)) {
            await client.query('SAVEPOINT sp_create_soft_skills');
            try {
                for (const score of softSkillScores) {
                    const ratingNum = parseFloat(score?.rating) || 0;
                    const weightNum = getSoftSkillWeightFromRating(ratingNum);
                    const weightedScoreNum = weightNum * ratingNum;
                    await client.query(
                        `INSERT INTO appraisal_soft_skill_scores 
                         (appraisal_id, soft_skill_id, rating, weighted_score, comments)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [appraisalId, score.softSkillId ?? score.soft_skill_id ?? null, (score.rating === '' || score.rating === null || score.rating === undefined) ? null : ratingNum, weightedScoreNum, score.comments ?? null]
                    );
                }
                await client.query('RELEASE SAVEPOINT sp_create_soft_skills');
            } catch (e) {
                console.error('Create soft skill scores error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_create_soft_skills');
                await client.query('RELEASE SAVEPOINT sp_create_soft_skills');
                throw e;
            }
        }

        if (developmentPlans && Array.isArray(developmentPlans)) {
            await client.query('SAVEPOINT sp_create_dev_plans');
            try {
                const dpColsResult = await client.query(
                    `SELECT column_name
                     FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'appraisal_development_plans'`
                );
                const dpCols = new Set(dpColsResult.rows.map(r => r.column_name));
                const descCol = dpCols.has('plan_description') ? 'plan_description'
                    : (dpCols.has('description') ? 'description'
                    : (dpCols.has('plan') ? 'plan'
                    : (dpCols.has('development_plan') ? 'development_plan'
                    : (dpCols.has('area_for_development') ? 'area_for_development' : null))));
                const actionsCol = dpCols.has('manager_actions') ? 'manager_actions'
                    : (dpCols.has('manager_action') ? 'manager_action'
                    : (dpCols.has('actions') ? 'actions'
                    : (dpCols.has('manager_support') ? 'manager_support' : null)));
                const dateCol = dpCols.has('target_completion_date') ? 'target_completion_date'
                    : (dpCols.has('targeted_completion_date') ? 'targeted_completion_date'
                    : (dpCols.has('target_date') ? 'target_date'
                    : (dpCols.has('completion_date') ? 'completion_date'
                    : (dpCols.has('due_date') ? 'due_date' : null))));
                const typeCol = dpCols.has('plan_type') ? 'plan_type'
                    : (dpCols.has('type') ? 'type' : null);

                for (const plan of developmentPlans) {
                    const descriptionValue = plan?.description ?? plan?.plan_description ?? plan?.planDescription ?? '';
                    if (!descriptionValue) continue;
                    const cols = ['appraisal_id'];
                    const placeholders = ['$1'];
                    const values = [appraisalId];
                    let p = 2;

                    if (typeCol) {
                        cols.push(typeCol);
                        placeholders.push(`$${p++}`);
                        const t = plan?.planType ?? plan?.plan_type ?? plan?.type ?? 'Development';
                        values.push((typeof t === 'string' && t.trim() === '') ? 'Development' : t);
                    }

                    if (descCol) {
                        cols.push(descCol);
                        placeholders.push(`$${p++}`);
                        values.push(descriptionValue);
                    }
                    if (actionsCol) {
                        cols.push(actionsCol);
                        placeholders.push(`$${p++}`);
                        values.push(plan?.managerActions ?? plan?.manager_actions ?? plan?.managerActionsText ?? '');
                    }
                    if (dateCol) {
                        cols.push(dateCol);
                        placeholders.push(`$${p++}`);
                        const dateRaw = plan?.targetDate ?? plan?.target_completion_date ?? plan?.targetCompletionDate ?? null;
                        values.push((typeof dateRaw === 'string' && dateRaw.trim() === '') ? null : dateRaw);
                    }

                    if (cols.length > 1) {
                        await client.query(
                            `INSERT INTO appraisal_development_plans (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
                            values
                        );
                    }
                }

                await client.query('RELEASE SAVEPOINT sp_create_dev_plans');
            } catch (e) {
                console.error('Create development plans error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_create_dev_plans');
                await client.query('RELEASE SAVEPOINT sp_create_dev_plans');
            }
        }

        // Create KRA scores if provided (legacy + supports Section B persistence)
        if (kraScores && Array.isArray(kraScores)) {
            await client.query('SAVEPOINT sp_create_kra_scores');
            try {
                // If table doesn't exist in a particular environment, the savepoint rollback keeps the transaction alive.
                await client.query('DELETE FROM appraisal_kra_scores WHERE appraisal_id = $1', [appraisalId]);

                const resolveKraId = async (score) => {
                    const directId = score.kraId ?? score.kra_id;
                    if (directId) return directId;

                    const kraName = (score.kraName || score.keyResultArea || score.key_result_area || score.pillar || score.sectionName || 'KRA').trim();
                    const pillarName = (score.pillarName || score.pillar || '').trim();
                    let pillarId = null;

                    if (pillarName) {
                        const pillar = await client.query(
                            `SELECT id FROM appraisal_pillars WHERE TRIM(name) ILIKE TRIM($1) AND is_active = true ORDER BY id DESC LIMIT 1`,
                            [pillarName]
                        );
                        if (pillar.rows.length > 0) pillarId = pillar.rows[0].id;
                    }

                    const existingKra = await client.query(
                        `SELECT id FROM appraisal_kras WHERE TRIM(name) ILIKE TRIM($1) AND pillar_id IS NOT DISTINCT FROM $2 ORDER BY id DESC LIMIT 1`,
                        [kraName, pillarId]
                    );
                    if (existingKra.rows.length > 0) return existingKra.rows[0].id;

                    const weight = parseFloat(score.weight) || 0;
                    const inserted = await client.query(
                        `INSERT INTO appraisal_kras (pillar_id, name, description, weight, sort_order, is_active)
                         VALUES ($1, $2, $3, $4, 0, true)
                         RETURNING id`,
                        [pillarId, kraName, score.target || null, weight]
                    );
                    return inserted.rows[0].id;
                };

                const toNumberOrNull = (v) => {
                    if (v === undefined || v === null) return null;
                    if (typeof v === 'string' && v.trim() === '') return null;
                    const n = Number(v);
                    return Number.isFinite(n) ? n : null;
                };

                for (const score of kraScores) {
                    const kraId = await resolveKraId(score);
                    await client.query(
                        `INSERT INTO appraisal_kra_scores 
                         (appraisal_id, kra_id, target, actual_achievement,
                          jan_target, jan_actual, jan_percent,
                          feb_target, feb_actual, feb_percent,
                          mar_target, mar_actual, mar_percent,
                          apr_target, apr_actual, apr_percent,
                          may_target, may_actual, may_percent,
                          jun_target, jun_actual, jun_percent,
                          target_total, actual_total, percent_achieved, weighted_average,
                          supervisor_comments)
                         VALUES ($1, $2, $3, $4,
                                 $5, $6, $7,
                                 $8, $9, $10,
                                 $11, $12, $13,
                                 $14, $15, $16,
                                 $17, $18, $19,
                                 $20, $21, $22,
                                 $23, $24, $25, $26,
                                 $27)`,
                        [
                            appraisalId,
                            kraId,
                            score.target || null,
                            score.actualAchievement ?? score.actual_achievement ?? null,
                            toNumberOrNull(score.janTarget ?? score.jan_target),
                            toNumberOrNull(score.janActual ?? score.jan_actual),
                            toNumberOrNull(score.janPercent ?? score.jan_percent),
                            toNumberOrNull(score.febTarget ?? score.feb_target),
                            toNumberOrNull(score.febActual ?? score.feb_actual),
                            toNumberOrNull(score.febPercent ?? score.feb_percent),
                            toNumberOrNull(score.marTarget ?? score.mar_target),
                            toNumberOrNull(score.marActual ?? score.mar_actual),
                            toNumberOrNull(score.marPercent ?? score.mar_percent),
                            toNumberOrNull(score.aprTarget ?? score.apr_target),
                            toNumberOrNull(score.aprActual ?? score.apr_actual),
                            toNumberOrNull(score.aprPercent ?? score.apr_percent),
                            toNumberOrNull(score.mayTarget ?? score.may_target),
                            toNumberOrNull(score.mayActual ?? score.may_actual),
                            toNumberOrNull(score.mayPercent ?? score.may_percent),
                            toNumberOrNull(score.junTarget ?? score.jun_target),
                            toNumberOrNull(score.junActual ?? score.jun_actual),
                            toNumberOrNull(score.junPercent ?? score.jun_percent),
                            toNumberOrNull(score.targetTotal ?? score.target_total),
                            toNumberOrNull(score.actualTotal ?? score.actual_total),
                            toNumberOrNull(score.percentAchieved ?? score.percent_achieved),
                            toNumberOrNull(score.weightedAverage ?? score.weighted_average),
                            score.supervisorComments ?? score.supervisor_comments ?? null
                        ]
                    );
                }

                await client.query('RELEASE SAVEPOINT sp_create_kra_scores');
            } catch (e) {
                console.error('Create KRA scores error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_create_kra_scores');
                await client.query('RELEASE SAVEPOINT sp_create_kra_scores');
            }
        }

        const derivedStatus = derivePerformanceAppraisalStatus({
            kraScores,
            performanceSections,
            sectionBTotal: sectionBTotalNum,
            softSkillScores,
            sectionCTotal: sectionCTotalNum,
            appraiserComments,
            hodComments,
            hrComments,
            ceoComments
        });

        if (createAppraisalColumns.has('status')) {
            const updates = [];
            const vals = [];
            let p = 1;

            updates.push(`status = $${p++}`);
            vals.push(derivedStatus);

            updates.push(...getSignatureDateUpdateFragments({ derivedStatus, columns: createAppraisalColumns }));

            vals.push(appraisalId);
            await client.query(
                `UPDATE performance_appraisals SET ${updates.join(', ')} WHERE id = $${p}`,
                vals
            );
        }

        await client.query('COMMIT');

        await logAudit(creatorId, 'CREATE_PERFORMANCE_APPRAISAL', 'PerformanceAppraisal', appraisalId,
            { userId, periodYear, periodQuarter }, req);

        res.status(201).json({
            message: 'Performance appraisal created successfully',
            id: appraisalId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create appraisal error:', error);
        res.status(500).json({ error: 'Failed to create appraisal', details: error.message });
    } finally {
        client.release();
    }
};

// Get all appraisals
const getAppraisals = async (req, res) => {
    try {
        const { userId, periodYear, status } = req.query;
        const currentUser = req.user;

        let query = `
             SELECT pa.*, 
                    u.email as user_email,
                    sp.first_name, sp.last_name, sp.employee_number, sp.job_title,
                    d.name as department_name,
                    sup.first_name as supervisor_first_name,
                    sup.last_name as supervisor_last_name
             FROM performance_appraisals pa
             LEFT JOIN users u ON pa.user_id = u.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN users sup_user ON pa.supervisor_id = sup_user.id
             LEFT JOIN staff_profiles sup ON sup_user.id = sup.user_id
             WHERE (pa.deleted_at IS NULL AND pa.user_id IS NOT NULL)
         `;

        const params = [];
        let paramCount = 1;

        // Role-based filtering - HR, CEO, Super Admin can see all
        if (currentUser.role_name === 'Staff') {
            query += ` AND pa.user_id = $${paramCount}`;
            params.push(currentUser.id);
            paramCount++;
        } else if (currentUser.role_name === 'Supervisor') {
            query += ` AND (pa.supervisor_id = $${paramCount} OR pa.user_id = $${paramCount})`;
            params.push(currentUser.id);
            paramCount++;
        } else if (currentUser.role_name === 'HOD') {
            query += ` AND u.department_id = $${paramCount}`;
            params.push(currentUser.department_id);
            paramCount++;
        }
        // HR, CEO, Super Admin see all appraisals - no filter needed

        if (userId) {
            query += ` AND pa.user_id = $${paramCount}`;
            params.push(userId);
            paramCount++;
        }

        if (periodYear) {
            query += ` AND pa.period_year = $${paramCount}`;
            params.push(periodYear);
            paramCount++;
        }

        query += ' ORDER BY pa.period_year DESC NULLS LAST, pa.period_quarter DESC NULLS LAST, pa.created_at DESC';

        const result = await db.query(query, params);

        const sectionBMap = new Map();
        const sectionCMap = new Map();
        const kraMap = new Map();

        try {
            const bRes = await db.query(
                `SELECT appraisal_id, COUNT(*)::int AS c
                 FROM performance_section_scores
                 WHERE COALESCE(target_total, 0) > 0
                    OR COALESCE(actual_total, 0) > 0
                    OR COALESCE(percent_achieved, 0) > 0
                    OR COALESCE(weighted_average, 0) > 0
                 GROUP BY appraisal_id`
            );
            for (const r of bRes.rows) {
                sectionBMap.set(String(r.appraisal_id), (Number(r.c) || 0) > 0);
            }
        } catch (e) {
        }

        try {
            const kRes = await db.query(
                `SELECT appraisal_id, COUNT(*)::int AS c
                 FROM appraisal_kra_scores
                 WHERE COALESCE(target_total, 0) > 0
                    OR COALESCE(actual_total, 0) > 0
                    OR COALESCE(percent_achieved, 0) > 0
                    OR COALESCE(weighted_average, 0) > 0
                 GROUP BY appraisal_id`
            );
            for (const r of kRes.rows) {
                kraMap.set(String(r.appraisal_id), (Number(r.c) || 0) > 0);
            }
        } catch (e) {
        }

        try {
            const cRes = await db.query(
                `SELECT appraisal_id, COUNT(*)::int AS c
                 FROM appraisal_soft_skill_scores
                 WHERE rating IS NOT NULL AND rating > 0
                 GROUP BY appraisal_id`
            );
            for (const r of cRes.rows) {
                sectionCMap.set(String(r.appraisal_id), (Number(r.c) || 0) > 0);
            }
        } catch (e) {
        }

        const rows = [];
        for (const row of result.rows) {
            const idKey = String(row.id);

            const hasSectionB =
                Boolean(sectionBMap.get(idKey)) ||
                Boolean(kraMap.get(idKey)) ||
                ((parseFloat(row.section_b_total) || 0) > 0);

            const hasSectionC =
                Boolean(sectionCMap.get(idKey)) ||
                ((parseFloat(row.section_c_total) || 0) > 0);

            const derivedStatus = derivePerformanceAppraisalStatusFromCompleteness({
                hasSectionB,
                hasSectionC,
                appraiserComments: row.appraiser_comments,
                hodComments: row.hod_comments,
                hrComments: row.hr_comments,
                ceoComments: row.ceo_comments
            });

            if (status && String(derivedStatus) !== String(status)) continue;

            rows.push({
                ...row,
                status: derivedStatus
            });
        }

        res.json(rows);
    } catch (error) {
        console.error('Get appraisals error:', error);
        res.status(500).json({ error: 'Failed to fetch appraisals', details: error.message });
    }
};

// Get single appraisal by ID
const getAppraisalById = async (req, res) => {
    try {
        const { id } = req.params;

        const appraisal = await db.query(
            `SELECT pa.*, 
                   u.email as user_email,
                   r.name as role_name,
                   sp.first_name, sp.last_name, sp.employee_number, sp.job_title,
                   d.name as department_name,
                   sup.first_name as supervisor_first_name,
                   sup.last_name as supervisor_last_name
            FROM performance_appraisals pa
            JOIN users u ON pa.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            JOIN staff_profiles sp ON u.id = sp.user_id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN users sup_user ON pa.supervisor_id = sup_user.id
            LEFT JOIN staff_profiles sup ON sup_user.id = sup.user_id
            WHERE pa.id = $1 AND pa.deleted_at IS NULL`,
            [id]
        );

        if (appraisal.rows.length === 0) {
            return res.status(404).json({ error: 'Appraisal not found' });
        }

        const allowed = await canAccessAppraisalForUserId(db, req.user, appraisal.rows[0].user_id);
        if (!allowed) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        // Get KRA scores
        const kraScores = await db.query(
            `SELECT aks.*, ak.name as kra_name, ak.weight as kra_weight, ap.name as pillar_name
             FROM appraisal_kra_scores aks
             JOIN appraisal_kras ak ON aks.kra_id = ak.id
             LEFT JOIN appraisal_pillars ap ON ak.pillar_id = ap.id
             WHERE aks.appraisal_id = $1
             ORDER BY COALESCE(ap.sort_order, 999) ASC, ak.sort_order ASC`,
            [id]
        );

        // Get soft skill scores
        const softSkillScores = await db.query(
            `SELECT asss.*, ass.name as skill_name, ass.description, ass.weight
             FROM appraisal_soft_skill_scores asss
             JOIN appraisal_soft_skills ass ON asss.soft_skill_id = ass.id
             WHERE asss.appraisal_id = $1
             ORDER BY ass.sort_order`,
            [id]
        );

        // Get courses
        const courses = await db.query(
            `SELECT * FROM appraisal_courses WHERE appraisal_id = $1`,
            [id]
        );

        // Get development plans
        const developmentPlans = await db.query(
            `SELECT * FROM appraisal_development_plans WHERE appraisal_id = $1`,
            [id]
        );

        let performanceSectionScores = { rows: [] };
        try {
            performanceSectionScores = await db.query(
                `SELECT * FROM performance_section_scores WHERE appraisal_id = $1 ORDER BY section_name, id`,
                [id]
            );
        } catch (e) {
            performanceSectionScores = { rows: [] };
        }

        const hasSectionB =
            ((parseFloat(appraisal.rows[0]?.section_b_total) || 0) > 0) ||
            (Array.isArray(kraScores.rows) && kraScores.rows.some(s => (parseFloat(s?.target_total) || 0) > 0 || (parseFloat(s?.actual_total) || 0) > 0 || (parseFloat(s?.percent_achieved) || 0) > 0 || (parseFloat(s?.weighted_average) || 0) > 0)) ||
            (Array.isArray(performanceSectionScores.rows) && performanceSectionScores.rows.some(s => (parseFloat(s?.target_total) || 0) > 0 || (parseFloat(s?.actual_total) || 0) > 0 || (parseFloat(s?.percent_achieved) || 0) > 0 || (parseFloat(s?.weighted_average) || 0) > 0));

        const hasSectionC =
            ((parseFloat(appraisal.rows[0]?.section_c_total) || 0) > 0) ||
            (Array.isArray(softSkillScores.rows) && softSkillScores.rows.some(s => (parseFloat(s?.rating) || 0) > 0));

        const derivedStatus = derivePerformanceAppraisalStatusFromCompleteness({
            hasSectionB,
            hasSectionC,
            appraiserComments: appraisal.rows[0]?.appraiser_comments,
            hodComments: appraisal.rows[0]?.hod_comments,
            hrComments: appraisal.rows[0]?.hr_comments,
            ceoComments: appraisal.rows[0]?.ceo_comments
        });

        res.json({
            ...appraisal.rows[0],
            status: derivedStatus,
            kraScores: kraScores.rows,
            softSkillScores: softSkillScores.rows,
            courses: courses.rows,
            developmentPlans: developmentPlans.rows.map(p => ({
                id: p.id,
                plan_description: p.plan_description ?? p.description ?? p.plan ?? p.development_plan ?? p.area_for_development ?? '',
                manager_actions: p.manager_actions ?? p.manager_action ?? p.actions ?? p.manager_support ?? '',
                target_completion_date: p.target_completion_date ?? p.targeted_completion_date ?? p.target_date ?? p.completion_date ?? p.due_date ?? null,
                created_at: p.created_at
            })),
            performanceSectionScores: performanceSectionScores.rows,
            performanceSectionsData: appraisal.rows[0]?.performance_sections_data
        });
    } catch (error) {
        console.error('Get appraisal error:', error);
        res.status(500).json({ error: 'Failed to fetch appraisal' });
    }
};

// Update appraisal
const updateAppraisal = async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        const { id } = req.params;
        const currentUser = req.user;
        let {
            userId,
            branchDepartment,
            position,
            pfNumber,
            supervisorDesignation,
            appraisalDate,
            periodType,
            periodYear,
            periodQuarter,
            periodSemi,
            status,
            performanceSections,
            kraScores,
            sectionBTotal,
            softSkillScores,
            sectionCTotal,
            overallRating,
            courses,
            developmentPlans,
            appraiseeComments,
            appraiserComments,
            hodComments,
            hrComments,
            ceoComments
        } = req.body;

        await client.query('BEGIN');

        await ensurePerformanceAppraisalSchema(client);

        const columnsResult = await client.query(
            `SELECT column_name, is_nullable
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'performance_appraisals'`
        );
        const appraisalColumns = new Set(columnsResult.rows.map(r => r.column_name));
        const appraisalColumnMeta = new Map(columnsResult.rows.map(r => [r.column_name, r]));
        const staffIdNullable = appraisalColumnMeta.get('staff_id')?.is_nullable === 'YES';

        const selectColumns = [
            'id',
            'user_id',
            'status',
            'section_b_total',
            'section_c_total',
            'appraiser_comments',
            'hod_comments',
            'hr_comments',
            'ceo_comments'
        ];

        if (appraisalColumns.has('staff_id')) {
            selectColumns.push('staff_id');
        }
        if (appraisalColumns.has('appraisal_period_id')) {
            selectColumns.push('appraisal_period_id');
        }

        const existing = await client.query(
            appraisalColumns.has('deleted_at')
                ? `SELECT ${selectColumns.join(', ')}
                   FROM performance_appraisals
                   WHERE id = $1 AND deleted_at IS NULL`
                : `SELECT ${selectColumns.join(', ')}
                   FROM performance_appraisals
                   WHERE id = $1`,
            [id]
        );
        if (existing.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Appraisal not found' });
        }

        const existingRow = existing.rows[0] || {};
        const existingUserId = existingRow?.user_id;
        const role = (currentUser?.role_name || '').trim();

        const allowed = await canAccessAppraisalForUserId(client, currentUser, existingUserId);
        if (!allowed) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        if (userId !== undefined && userId !== null && existingUserId && String(userId) !== String(existingUserId)) {
            if (!isPrivilegedRole(currentUser)) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
            }
        }

        const isOwn = existingUserId && String(currentUser.id) === String(existingUserId);

        if (!isPrivilegedRole(currentUser) && !isOwn) {
            appraiseeComments = undefined;
        }

        if (!isPrivilegedRole(currentUser)) {
            if (role === 'Supervisor' && !isOwn) {
                userId = undefined;
                branchDepartment = undefined;
                position = undefined;
                pfNumber = undefined;
                supervisorDesignation = undefined;
                appraisalDate = undefined;
                periodType = undefined;
                periodYear = undefined;
                periodQuarter = undefined;
                periodSemi = undefined;
                status = undefined;
                performanceSections = undefined;
                kraScores = undefined;
                sectionBTotal = undefined;
                courses = undefined;
                developmentPlans = undefined;
                hodComments = undefined;
                hrComments = undefined;
                ceoComments = undefined;
            }

            if (role === 'Supervisor' && isOwn) {
                userId = undefined;
                branchDepartment = undefined;
                position = undefined;
                pfNumber = undefined;
                supervisorDesignation = undefined;
                appraisalDate = undefined;
                periodType = undefined;
                periodYear = undefined;
                periodQuarter = undefined;
                periodSemi = undefined;
                status = undefined;
                softSkillScores = undefined;
                sectionCTotal = undefined;
                appraiserComments = undefined;
                hodComments = undefined;
                hrComments = undefined;
                ceoComments = undefined;
            }

            if (role === 'Staff') {
                userId = undefined;
                branchDepartment = undefined;
                position = undefined;
                pfNumber = undefined;
                supervisorDesignation = undefined;
                appraisalDate = undefined;
                periodType = undefined;
                periodYear = undefined;
                periodQuarter = undefined;
                periodSemi = undefined;
                status = undefined;
                softSkillScores = undefined;
                sectionCTotal = undefined;
                appraiserComments = undefined;
                hodComments = undefined;
                hrComments = undefined;
                ceoComments = undefined;
            }
        }

        const shouldUpdateSectionB = (sectionBTotal !== undefined) || (kraScores && Array.isArray(kraScores)) || (performanceSections && Array.isArray(performanceSections));
        const shouldUpdateSectionC = (sectionCTotal !== undefined) || (softSkillScores && Array.isArray(softSkillScores));

        const sectionBTotalNum = shouldUpdateSectionB
            ? computeSectionBTotal({ kraScores, performanceSections, fallback: sectionBTotal })
            : null;
        const sectionCTotalNum = shouldUpdateSectionC
            ? computeSectionCTotal({ softSkillScores, fallback: sectionCTotal })
            : null;

        const nextSectionBTotal = sectionBTotalNum !== null
            ? sectionBTotalNum
            : (parseFloat(existingRow?.section_b_total) || 0);
        const nextSectionCTotal = sectionCTotalNum !== null
            ? sectionCTotalNum
            : (parseFloat(existingRow?.section_c_total) || 0);

        const nextAppraiserComments = (appraiserComments !== undefined) ? appraiserComments : existingRow?.appraiser_comments;
        const nextHodComments = (hodComments !== undefined) ? hodComments : existingRow?.hod_comments;
        const nextHrComments = (hrComments !== undefined) ? hrComments : existingRow?.hr_comments;
        const nextCeoComments = (ceoComments !== undefined) ? ceoComments : existingRow?.ceo_comments;

        const derivedStatus = derivePerformanceAppraisalStatus({
            kraScores: shouldUpdateSectionB ? kraScores : null,
            performanceSections: shouldUpdateSectionB ? performanceSections : null,
            sectionBTotal: nextSectionBTotal,
            softSkillScores: shouldUpdateSectionC ? softSkillScores : null,
            sectionCTotal: nextSectionCTotal,
            appraiserComments: nextAppraiserComments,
            hodComments: nextHodComments,
            hrComments: nextHrComments,
            ceoComments: nextCeoComments
        });

        // Update main record
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        const targetUserId = userId || existing.rows[0]?.user_id;
        const existingStaffId = existingRow?.staff_id || null;
        if (targetUserId) {
            const resolvedSupervisorId = await resolveSupervisorStaffId(client, targetUserId, null);
            if (resolvedSupervisorId && appraisalColumns.has('supervisor_id')) {
                updateFields.push(`supervisor_id = $${paramCount++}`);
                updateValues.push(resolvedSupervisorId);
            }
        }

        if (appraisalColumns.has('staff_id')) {
            const userIdChanged = userId !== undefined && userId !== null
                && String(userId) !== String(existingRow?.user_id);
            const shouldResolveStaff = userIdChanged || (!existingStaffId && targetUserId);

            if (shouldResolveStaff) {
                const resolvedStaffId = await resolveStaffIdForAppraisal(client, userIdChanged ? userId : targetUserId);
                if (!resolvedStaffId && !staffIdNullable) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        error: 'Staff profile is required for this appraisal. Please create the staff profile first.'
                    });
                }
                if (resolvedStaffId) {
                    updateFields.push(`staff_id = $${paramCount++}`);
                    updateValues.push(resolvedStaffId);
                }
            }
        }

        if (branchDepartment !== undefined && appraisalColumns.has('branch_department')) {
            updateFields.push(`branch_department = $${paramCount++}`);
            updateValues.push(branchDepartment || null);
        }

        if (position !== undefined && appraisalColumns.has('position')) {
            updateFields.push(`position = $${paramCount++}`);
            updateValues.push(position || null);
        }

        if (pfNumber !== undefined && appraisalColumns.has('pf_number')) {
            updateFields.push(`pf_number = $${paramCount++}`);
            updateValues.push(pfNumber || null);
        }

        if (supervisorDesignation !== undefined && appraisalColumns.has('supervisor_designation')) {
            updateFields.push(`supervisor_designation = $${paramCount++}`);
            updateValues.push(supervisorDesignation || null);
        }

        if (appraisalDate !== undefined && appraisalColumns.has('appraisal_date')) {
            updateFields.push(`appraisal_date = $${paramCount++}`);
            updateValues.push(appraisalDate || null);
        }

        if (periodType !== undefined && appraisalColumns.has('period_type')) {
            updateFields.push(`period_type = $${paramCount++}`);
            updateValues.push(periodType || null);
        }

        if (periodYear !== undefined && appraisalColumns.has('period_year')) {
            updateFields.push(`period_year = $${paramCount++}`);
            updateValues.push(parseInt(periodYear) || null);
        }

        if (periodQuarter !== undefined && appraisalColumns.has('period_quarter')) {
            updateFields.push(`period_quarter = $${paramCount++}`);
            updateValues.push(periodQuarter !== null ? (parseInt(periodQuarter) || null) : null);
        }

        if (periodSemi !== undefined && appraisalColumns.has('period_semi')) {
            updateFields.push(`period_semi = $${paramCount++}`);
            updateValues.push(periodSemi !== null ? (parseInt(periodSemi) || null) : null);
        }

        if (appraisalColumns.has('status')) {
            updateFields.push(`status = $${paramCount++}`);
            updateValues.push(derivedStatus);
        }

        updateFields.push(...getSignatureDateUpdateFragments({ derivedStatus, columns: appraisalColumns }));

        if (appraiseeComments !== undefined) {
            if (appraisalColumns.has('appraisee_comments')) {
                updateFields.push(`appraisee_comments = $${paramCount++}`);
                updateValues.push(appraiseeComments);
            }
        }

        if (appraiserComments !== undefined) {
            if (appraisalColumns.has('appraiser_comments')) {
                updateFields.push(`appraiser_comments = $${paramCount++}`);
                updateValues.push(appraiserComments);
            }
        }

        if (hodComments !== undefined) {
            if (appraisalColumns.has('hod_comments')) {
                updateFields.push(`hod_comments = $${paramCount++}`);
                updateValues.push(hodComments);
            }
        }

        if (hrComments !== undefined) {
            if (appraisalColumns.has('hr_comments')) {
                updateFields.push(`hr_comments = $${paramCount++}`);
                updateValues.push(hrComments);
            }
        }

        if (ceoComments !== undefined) {
            if (appraisalColumns.has('ceo_comments')) {
                updateFields.push(`ceo_comments = $${paramCount++}`);
                updateValues.push(ceoComments);
            }
        }

        if (sectionBTotalNum !== null) {
            if (appraisalColumns.has('section_b_total')) {
                updateFields.push(`section_b_total = $${paramCount++}`);
                updateValues.push(sectionBTotalNum);
            }
        }

        if (sectionCTotalNum !== null) {
            if (appraisalColumns.has('section_c_total')) {
                updateFields.push(`section_c_total = $${paramCount++}`);
                updateValues.push(sectionCTotalNum);
            }
        }

        if (sectionBTotalNum !== null) {
            if (appraisalColumns.has('section_b_weighted_total')) {
                updateFields.push(`section_b_weighted_total = $${paramCount++}`);
                updateValues.push(sectionBTotalNum);
            }
            if (appraisalColumns.has('strategic_objectives_score')) {
                updateFields.push(`strategic_objectives_score = $${paramCount++}`);
                updateValues.push(sectionBTotalNum);
            }
        }

        if (sectionCTotalNum !== null) {
            if (appraisalColumns.has('section_c_weighted_total')) {
                updateFields.push(`section_c_weighted_total = $${paramCount++}`);
                updateValues.push(sectionCTotalNum);
            }
            if (appraisalColumns.has('soft_skills_score')) {
                updateFields.push(`soft_skills_score = $${paramCount++}`);
                updateValues.push(sectionCTotalNum);
            }
        }

        const shouldUpdateOverallScore = (sectionBTotalNum !== null) || (sectionCTotalNum !== null);
        if (shouldUpdateOverallScore) {
            const overall = (parseFloat(nextSectionBTotal) || 0) + (parseFloat(nextSectionCTotal) || 0);
            if (appraisalColumns.has('overall_score')) {
                updateFields.push(`overall_score = $${paramCount++}`);
                updateValues.push(overall);
            }
            if (appraisalColumns.has('total_performance_rating')) {
                updateFields.push(`total_performance_rating = $${paramCount++}`);
                updateValues.push(overall);
            }
        }

        updateValues.push(id);

        if (updateFields.length > 0) {
            const updatedAtClause = appraisalColumns.has('updated_at') ? ', updated_at = CURRENT_TIMESTAMP' : '';
            await client.query(
                `UPDATE performance_appraisals 
                 SET ${updateFields.join(', ')}${updatedAtClause}
                 WHERE id = $${paramCount}`,
                updateValues
            );
        }

        if (performanceSections && Array.isArray(performanceSections)) {
            if (appraisalColumns.has('performance_sections_data')) {
                await client.query('SAVEPOINT sp_update_perf_sections_json');
                try {
                    await client.query(
                        `UPDATE performance_appraisals SET performance_sections_data = $1 WHERE id = $2`,
                        [JSON.stringify(performanceSections), id]
                    );
                    await client.query('RELEASE SAVEPOINT sp_update_perf_sections_json');
                } catch (e) {
                    console.error('Update performance sections JSON error:', e);
                    await client.query('ROLLBACK TO SAVEPOINT sp_update_perf_sections_json');
                    await client.query('RELEASE SAVEPOINT sp_update_perf_sections_json');
                    throw e;
                }
            }

            await client.query('SAVEPOINT sp_update_perf_sections_rows');
            try {
                const pssCols = await getPerformanceSectionScoreColumns(client);
                if (pssCols.size > 0) {
                    await client.query('DELETE FROM performance_section_scores WHERE appraisal_id = $1', [id]);
                }
                for (const section of performanceSections) {
                    const sectionName = section?.name || section?.sectionName || section?.section_name;
                    if (!sectionName) continue;
                    const rows = Array.isArray(section.rows) ? section.rows : [];
                    for (const row of rows) {
                        if (!row) continue;
                        const hasAny = Boolean(row.pillar || row.keyResultArea || row.target);
                        if (!hasAny) continue;

                        await insertPerformanceSectionScoreRow({
                            client,
                            columns: pssCols,
                            appraisalId: id,
                            sectionName,
                            row
                        });
                    }
                }
                await client.query('RELEASE SAVEPOINT sp_update_perf_sections_rows');
            } catch (e) {
                console.error('Update performance sections rows error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_update_perf_sections_rows');
                await client.query('RELEASE SAVEPOINT sp_update_perf_sections_rows');
                throw e;
            }
        }

        const resolveKraId = async (score) => {
            const directId = score.kraId ?? score.kra_id;
            if (directId) return directId;

            const kraName = (score.kraName || score.keyResultArea || score.key_result_area || score.pillar || score.sectionName || 'KRA').trim();
            const pillarName = (score.pillarName || score.pillar || '').trim();
            let pillarId = null;

            if (pillarName) {
                const pillar = await client.query(
                    `SELECT id FROM appraisal_pillars WHERE TRIM(name) ILIKE TRIM($1) AND is_active = true ORDER BY id DESC LIMIT 1`,
                    [pillarName]
                );
                if (pillar.rows.length > 0) pillarId = pillar.rows[0].id;
            }

            const existingKra = await client.query(
                `SELECT id FROM appraisal_kras WHERE TRIM(name) ILIKE TRIM($1) AND pillar_id IS NOT DISTINCT FROM $2 ORDER BY id DESC LIMIT 1`,
                [kraName, pillarId]
            );
            if (existingKra.rows.length > 0) return existingKra.rows[0].id;

            const weight = parseFloat(score.weight) || 0;
            const inserted = await client.query(
                `INSERT INTO appraisal_kras (pillar_id, name, description, weight, sort_order, is_active)
                 VALUES ($1, $2, $3, $4, 0, true)
                 RETURNING id`,
                [pillarId, kraName, score.target || null, weight]
            );
            return inserted.rows[0].id;
        };

        // Update KRA scores if provided
        if (kraScores && Array.isArray(kraScores)) {
            await client.query('SAVEPOINT sp_update_kra_scores');
            try {
                await client.query('DELETE FROM appraisal_kra_scores WHERE appraisal_id = $1', [id]);

                const toNumberOrNull = (v) => {
                    if (v === undefined || v === null) return null;
                    if (typeof v === 'string' && v.trim() === '') return null;
                    const n = Number(v);
                    return Number.isFinite(n) ? n : null;
                };
                
                for (const score of kraScores) {
                    const kraId = await resolveKraId(score);
                    await client.query(
                    `INSERT INTO appraisal_kra_scores 
                     (appraisal_id, kra_id, target, actual_achievement,
                      jan_target, jan_actual, jan_percent,
                      feb_target, feb_actual, feb_percent,
                      mar_target, mar_actual, mar_percent,
                      apr_target, apr_actual, apr_percent,
                      may_target, may_actual, may_percent,
                      jun_target, jun_actual, jun_percent,
                      target_total, actual_total, percent_achieved, weighted_average,
                      supervisor_comments)
                     VALUES ($1, $2, $3, $4,
                             $5, $6, $7,
                             $8, $9, $10,
                             $11, $12, $13,
                             $14, $15, $16,
                             $17, $18, $19,
                             $20, $21, $22,
                             $23, $24, $25, $26,
                             $27)`,
                    [
                        id,
                        kraId,
                        score.target || null,
                        score.actualAchievement ?? score.actual_achievement ?? null,
                        toNumberOrNull(score.janTarget ?? score.jan_target),
                        toNumberOrNull(score.janActual ?? score.jan_actual),
                        toNumberOrNull(score.janPercent ?? score.jan_percent),
                        toNumberOrNull(score.febTarget ?? score.feb_target),
                        toNumberOrNull(score.febActual ?? score.feb_actual),
                        toNumberOrNull(score.febPercent ?? score.feb_percent),
                        toNumberOrNull(score.marTarget ?? score.mar_target),
                        toNumberOrNull(score.marActual ?? score.mar_actual),
                        toNumberOrNull(score.marPercent ?? score.mar_percent),
                        toNumberOrNull(score.aprTarget ?? score.apr_target),
                        toNumberOrNull(score.aprActual ?? score.apr_actual),
                        toNumberOrNull(score.aprPercent ?? score.apr_percent),
                        toNumberOrNull(score.mayTarget ?? score.may_target),
                        toNumberOrNull(score.mayActual ?? score.may_actual),
                        toNumberOrNull(score.mayPercent ?? score.may_percent),
                        toNumberOrNull(score.junTarget ?? score.jun_target),
                        toNumberOrNull(score.junActual ?? score.jun_actual),
                        toNumberOrNull(score.junPercent ?? score.jun_percent),
                        toNumberOrNull(score.targetTotal ?? score.target_total),
                        toNumberOrNull(score.actualTotal ?? score.actual_total),
                        toNumberOrNull(score.percentAchieved ?? score.percent_achieved),
                        toNumberOrNull(score.weightedAverage ?? score.weighted_average),
                        score.supervisorComments ?? score.supervisor_comments ?? null
                    ]
                    );
                }
                await client.query('RELEASE SAVEPOINT sp_update_kra_scores');
            } catch (e) {
                console.error('Update KRA scores error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_update_kra_scores');
                await client.query('RELEASE SAVEPOINT sp_update_kra_scores');
            }
        }

        // Update soft skill scores if provided
        if (softSkillScores && Array.isArray(softSkillScores)) {
            await client.query('SAVEPOINT sp_update_soft_skills');
            try {
                await client.query('DELETE FROM appraisal_soft_skill_scores WHERE appraisal_id = $1', [id]);

                for (const score of softSkillScores) {
                    const ratingNum = parseFloat(score?.rating) || 0;
                    const weightNum = getSoftSkillWeightFromRating(ratingNum);
                    const weightedScoreNum = weightNum * ratingNum;

                    await client.query(
                        `INSERT INTO appraisal_soft_skill_scores 
                         (appraisal_id, soft_skill_id, rating, weighted_score, comments)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [id, score.softSkillId ?? score.soft_skill_id ?? null, (score.rating === '' || score.rating === null || score.rating === undefined) ? null : ratingNum, weightedScoreNum, score.comments ?? null]
                    );
                }

                await client.query('RELEASE SAVEPOINT sp_update_soft_skills');
            } catch (e) {
                console.error('Update soft skill scores error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_update_soft_skills');
                await client.query('RELEASE SAVEPOINT sp_update_soft_skills');
                throw e;
            }
        }

        if (courses && Array.isArray(courses)) {
            await client.query('SAVEPOINT sp_update_courses');
            try {
                await client.query('DELETE FROM appraisal_courses WHERE appraisal_id = $1', [id]);
                for (const course of courses) {
                    if (course?.name) {
                        await client.query(
                        `INSERT INTO appraisal_courses (appraisal_id, course_name, comments)
                         VALUES ($1, $2, $3)`,
                        [id, course.name, course.comments || '']
                        );
                    }
                }
                await client.query('RELEASE SAVEPOINT sp_update_courses');
            } catch (e) {
                console.error('Update courses error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_update_courses');
                await client.query('RELEASE SAVEPOINT sp_update_courses');
            }
        }

        if (developmentPlans && Array.isArray(developmentPlans)) {
            await client.query('SAVEPOINT sp_update_dev_plans');
            try {
                await client.query('DELETE FROM appraisal_development_plans WHERE appraisal_id = $1', [id]);

                const dpColsResult = await client.query(
                    `SELECT column_name
                     FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'appraisal_development_plans'`
                );
                const dpCols = new Set(dpColsResult.rows.map(r => r.column_name));
                const descCol = dpCols.has('plan_description') ? 'plan_description'
                    : (dpCols.has('description') ? 'description'
                    : (dpCols.has('plan') ? 'plan'
                    : (dpCols.has('development_plan') ? 'development_plan'
                    : (dpCols.has('area_for_development') ? 'area_for_development' : null))));
                const actionsCol = dpCols.has('manager_actions') ? 'manager_actions'
                    : (dpCols.has('manager_action') ? 'manager_action'
                    : (dpCols.has('actions') ? 'actions'
                    : (dpCols.has('manager_support') ? 'manager_support' : null)));
                const dateCol = dpCols.has('target_completion_date') ? 'target_completion_date'
                    : (dpCols.has('targeted_completion_date') ? 'targeted_completion_date'
                    : (dpCols.has('target_date') ? 'target_date'
                    : (dpCols.has('completion_date') ? 'completion_date'
                    : (dpCols.has('due_date') ? 'due_date' : null))));
                const typeCol = dpCols.has('plan_type') ? 'plan_type'
                    : (dpCols.has('type') ? 'type' : null);

                for (const plan of developmentPlans) {
                    const descriptionValue = plan?.description ?? plan?.plan_description ?? plan?.planDescription ?? '';
                    if (!descriptionValue) continue;

                    const cols = ['appraisal_id'];
                    const placeholders = ['$1'];
                    const values = [id];
                    let p = 2;

                    if (typeCol) {
                        cols.push(typeCol);
                        placeholders.push(`$${p++}`);
                        const t = plan?.planType ?? plan?.plan_type ?? plan?.type ?? 'Development';
                        values.push((typeof t === 'string' && t.trim() === '') ? 'Development' : t);
                    }

                    if (descCol) {
                        cols.push(descCol);
                        placeholders.push(`$${p++}`);
                        values.push(descriptionValue);
                    }
                    if (actionsCol) {
                        cols.push(actionsCol);
                        placeholders.push(`$${p++}`);
                        values.push(plan?.managerActions ?? plan?.manager_actions ?? plan?.managerActionsText ?? '');
                    }
                    if (dateCol) {
                        cols.push(dateCol);
                        placeholders.push(`$${p++}`);
                        const dateRaw = plan?.targetDate ?? plan?.target_completion_date ?? plan?.targetCompletionDate ?? null;
                        values.push((typeof dateRaw === 'string' && dateRaw.trim() === '') ? null : dateRaw);
                    }

                    if (cols.length > 1) {
                        await client.query(
                            `INSERT INTO appraisal_development_plans (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
                            values
                        );
                    }
                }

                await client.query('RELEASE SAVEPOINT sp_update_dev_plans');
            } catch (e) {
                console.error('Update development plans error:', e);
                await client.query('ROLLBACK TO SAVEPOINT sp_update_dev_plans');
                await client.query('RELEASE SAVEPOINT sp_update_dev_plans');
            }
        }

        if (
            appraisalColumns.has('section_b_weighted_total') &&
            appraisalColumns.has('section_c_weighted_total') &&
            (appraisalColumns.has('total_performance_rating') || appraisalColumns.has('overall_score'))
        ) {
            const totals = await client.query(
                `SELECT section_b_weighted_total, section_c_weighted_total FROM performance_appraisals WHERE id = $1`,
                [id]
            );
            
            if (totals.rows.length > 0) {
                const totalRating = parseFloat(totals.rows[0].section_b_weighted_total || 0) + 
                                   parseFloat(totals.rows[0].section_c_weighted_total || 0);
                const updates = [];
                const vals = [];
                let p = 1;

                if (appraisalColumns.has('total_performance_rating')) {
                    updates.push(`total_performance_rating = $${p++}`);
                    vals.push(totalRating);
                }
                if (appraisalColumns.has('overall_score')) {
                    updates.push(`overall_score = $${p++}`);
                    vals.push(totalRating);
                }

                if (updates.length > 0) {
                    vals.push(id);
                    await client.query(
                        `UPDATE performance_appraisals SET ${updates.join(', ')} WHERE id = $${p}`,
                        vals
                    );
                }
            }
        }

        await client.query('COMMIT');

        await logAudit(req.user.id, 'UPDATE_PERFORMANCE_APPRAISAL', 'PerformanceAppraisal', id, req.body, req);

        res.json({ message: 'Appraisal updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update appraisal error:', error);
        res.status(500).json({ error: 'Failed to update appraisal', details: error.message });
    } finally {
        client.release();
    }
};

// Delete appraisal
const deleteAppraisal = async (req, res) => {
    try {
        const { id } = req.params;

        const currentUser = req.user;
        const role = (currentUser?.role_name || '').trim();

        const appraisal = await db.query(
            `SELECT id, user_id
             FROM performance_appraisals
             WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        if (appraisal.rows.length === 0) {
            return res.status(404).json({ error: 'Appraisal not found' });
        }

        const appraisalUserId = appraisal.rows[0]?.user_id;
        if (appraisalUserId && currentUser.id === appraisalUserId && !(role === 'CEO' || role === 'Super Admin')) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        if (!(role === 'CEO' || role === 'HR' || role === 'Super Admin')) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        await db.query(
            'UPDATE performance_appraisals SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        await logAudit(req.user.id, 'DELETE_PERFORMANCE_APPRAISAL', 'PerformanceAppraisal', id, {}, req);

        res.json({ message: 'Appraisal deleted successfully' });
    } catch (error) {
        console.error('Delete appraisal error:', error);
        res.status(500).json({ error: 'Failed to delete appraisal' });
    }
};

// Get rating key
const getRatingKey = async (req, res) => {
    try {
        const ratingKey = [
            { point: 1, range: '70% and below', description: 'Below Expectation' },
            { point: 2, range: '71 – 80%', description: 'Meets some expectations' },
            { point: 3, range: '81 – 90%', description: 'Meets most expectation' },
            { point: 4, range: '91 – 100%', description: 'Meets Expectations' },
            { point: 5, range: '101 - 110%', description: 'Exceeds Expectations' },
            { point: 6, range: '111 and above', description: 'Most Outstanding' }
        ];
        res.json(ratingKey);
    } catch (error) {
        console.error('Get rating key error:', error);
        res.status(500).json({ error: 'Failed to fetch rating key' });
    }
};

// Manage KRAs
const createKRA = async (req, res) => {
    try {
        const { pillarId, name, description, weight, sortOrder } = req.body;
        
        const result = await db.query(
            `INSERT INTO appraisal_kras (pillar_id, name, description, weight, sort_order)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [pillarId, name, description, weight || 0, sortOrder || 0]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create KRA error:', error);
        res.status(500).json({ error: 'Failed to create KRA' });
    }
};

const updateKRA = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, weight, sortOrder, isActive } = req.body;
        
        await db.query(
            `UPDATE appraisal_kras 
             SET name = COALESCE($1, name), 
                 description = COALESCE($2, description),
                 weight = COALESCE($3, weight),
                 sort_order = COALESCE($4, sort_order),
                 is_active = COALESCE($5, is_active)
             WHERE id = $6`,
            [name, description, weight, sortOrder, isActive, id]
        );
        
        res.json({ message: 'KRA updated successfully' });
    } catch (error) {
        console.error('Update KRA error:', error);
        res.status(500).json({ error: 'Failed to update KRA' });
    }
};

const deleteKRA = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE appraisal_kras SET is_active = false WHERE id = $1', [id]);
        res.json({ message: 'KRA deleted successfully' });
    } catch (error) {
        console.error('Delete KRA error:', error);
        res.status(500).json({ error: 'Failed to delete KRA' });
    }
};

module.exports = {
    getPillarsWithKRAs,
    getSoftSkills,
    createAppraisal,
    getAppraisals,
    getAppraisalById,
    updateAppraisal,
    deleteAppraisal,
    getRatingKey,
    createKRA,
    updateKRA,
    deleteKRA
};
