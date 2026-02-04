const bcrypt = require('bcrypt');
require('dotenv').config();

const db = require('../database/db');

const shouldSeedUsers = () => String(process.env.AUTO_SEED_USERS || '').toLowerCase() === 'true';
const shouldSeedSuperAdmin = () => String(process.env.AUTO_SEED_SUPERADMIN || '').toLowerCase() !== 'false';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const ensureRolesAndDepartments = async (client) => {
    await client.query(
        `INSERT INTO roles (name, description, level) VALUES
        ('Super Admin', 'Full system control, above all other roles', 1),
        ('CEO', 'Chief Executive Officer, top executive', 2),
        ('HOD', 'Head of Department, departmental leadership', 3),
        ('HR', 'Human Resources, central HR authority', 4),
        ('Supervisor', 'Department supervisors, first-level management', 5),
        ('Staff', 'Regular staff members', 6)
        ON CONFLICT (name) DO NOTHING`
    );

    await client.query(
        `INSERT INTO departments (name, description) VALUES
        ('Finance', 'Financial operations and accounting'),
        ('ICT', 'Information and Communication Technology'),
        ('Admin', 'Administrative services and operations'),
        ('Marketing', 'Marketing and customer relations'),
        ('Operations', 'Core business operations'),
        ('Human Resources', 'HR department')
        ON CONFLICT (name) DO NOTHING`
    );
};

const getRoleIds = async (client) => {
    const res = await client.query('SELECT id, name FROM roles');
    const map = new Map();
    for (const r of res.rows) map.set(r.name, r.id);
    return map;
};

const getDepartmentIds = async (client) => {
    const res = await client.query('SELECT id, name FROM departments');
    const map = new Map();
    for (const d of res.rows) map.set(d.name, d.id);
    return map;
};

const upsertUser = async ({
    client,
    email,
    password,
    roleId,
    departmentId = null,
    supervisorUserId = null,
    isActive = true
}) => {
    const emailNorm = normalizeEmail(email);
    const passwordHash = await bcrypt.hash(password, 10);

    const res = await client.query(
        `INSERT INTO users (email, password_hash, role_id, department_id, supervisor_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email)
         DO UPDATE SET password_hash = EXCLUDED.password_hash,
                      role_id = EXCLUDED.role_id,
                      department_id = EXCLUDED.department_id,
                      supervisor_id = EXCLUDED.supervisor_id,
                      is_active = EXCLUDED.is_active,
                      updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [emailNorm, passwordHash, roleId, departmentId, supervisorUserId, isActive]
    );

    return res.rows[0].id;
};

const upsertProfile = async ({
    client,
    userId,
    firstName,
    lastName,
    employeeNumber,
    jobTitle
}) => {
    await client.query(
        `INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, date_joined, job_title)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)
         ON CONFLICT (user_id)
         DO UPDATE SET first_name = EXCLUDED.first_name,
                       last_name = EXCLUDED.last_name,
                       employee_number = EXCLUDED.employee_number,
                       job_title = EXCLUDED.job_title,
                       updated_at = CURRENT_TIMESTAMP`,
        [userId, firstName, lastName, employeeNumber, jobTitle]
    );
};

const main = async () => {
    const seedUsers = shouldSeedUsers();
    const seedSuperAdmin = shouldSeedSuperAdmin();

    if (!seedUsers && !seedSuperAdmin) {
        console.log('AUTO_SEED_USERS and AUTO_SEED_SUPERADMIN are disabled. Skipping user seeding.');
        process.exit(0);
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        await ensureRolesAndDepartments(client);

        const roleIds = await getRoleIds(client);
        if (seedSuperAdmin) {
            const superAdminEmail = 'johnsonmuhabi@gmail.com';
            const superAdminId = await upsertUser({
                client,
                email: superAdminEmail,
                password: 'Admin@0010',
                roleId: roleIds.get('Super Admin')
            });
            await upsertProfile({
                client,
                userId: superAdminId,
                firstName: 'Johnson',
                lastName: 'Muhabi',
                employeeNumber: 'EMP001',
                jobTitle: 'Super Administrator'
            });
        }

        if (seedUsers) {
            const deptIds = await getDepartmentIds(client);

            const ceoId = await upsertUser({
                client,
                email: 'ceo@winassacco.co.ke',
                password: 'Password@0609',
                roleId: roleIds.get('CEO')
            });
            await upsertProfile({
                client,
                userId: ceoId,
                firstName: 'CEO',
                lastName: 'Winas',
                employeeNumber: 'CEO001',
                jobTitle: 'Chief Executive Officer'
            });

            const hrMgrId = await upsertUser({
                client,
                email: 'hr.manager@winassacco.co.ke',
                password: 'Password@0609',
                roleId: roleIds.get('HR'),
                departmentId: deptIds.get('Human Resources') || null,
                supervisorUserId: ceoId
            });
            await upsertProfile({
                client,
                userId: hrMgrId,
                firstName: 'HR',
                lastName: 'Manager',
                employeeNumber: 'HRM001',
                jobTitle: 'HR Manager'
            });

            const departments = [
                { name: 'Finance', code: 'FIN' },
                { name: 'ICT', code: 'ICT' },
                { name: 'Admin', code: 'ADM' },
                { name: 'Marketing', code: 'MKT' },
                { name: 'Operations', code: 'OPS' },
                { name: 'Human Resources', code: 'HR' }
            ];

            const hodByDept = new Map();
            const supByDept = new Map();

            for (const dept of departments) {
                const deptId = deptIds.get(dept.name) || null;

                const hodEmail = `${dept.code.toLowerCase()}.hod@winassacco.co.ke`;
                const hodId = await upsertUser({
                    client,
                    email: hodEmail,
                    password: 'Password@0609',
                    roleId: roleIds.get('HOD'),
                    departmentId: deptId,
                    supervisorUserId: ceoId
                });
                await upsertProfile({
                    client,
                    userId: hodId,
                    firstName: dept.code,
                    lastName: 'HOD',
                    employeeNumber: `${dept.code}HOD001`,
                    jobTitle: `Head of ${dept.name}`
                });
                hodByDept.set(dept.name, hodId);

                const supEmail = `${dept.code.toLowerCase()}.supervisor@winassacco.co.ke`;
                const supId = await upsertUser({
                    client,
                    email: supEmail,
                    password: 'Password@0609',
                    roleId: roleIds.get('Supervisor'),
                    departmentId: deptId,
                    supervisorUserId: hodId
                });
                await upsertProfile({
                    client,
                    userId: supId,
                    firstName: dept.code,
                    lastName: 'Supervisor',
                    employeeNumber: `${dept.code}SUP001`,
                    jobTitle: `${dept.name} Supervisor`
                });
                supByDept.set(dept.name, supId);

                for (let i = 1; i <= 5; i++) {
                    const staffEmail = `${dept.code.toLowerCase()}.staff${i}@winassacco.co.ke`;
                    const staffId = await upsertUser({
                        client,
                        email: staffEmail,
                        password: 'Password@0609',
                        roleId: roleIds.get('Staff'),
                        departmentId: deptId,
                        supervisorUserId: supId
                    });
                    await upsertProfile({
                        client,
                        userId: staffId,
                        firstName: dept.code,
                        lastName: `Staff${i}`,
                        employeeNumber: `${dept.code}STF${String(i).padStart(2, '0')}`,
                        jobTitle: `${dept.name} Staff`
                    });
                }
            }
        }

        await client.query('COMMIT');

        console.log('✅ Seed users completed successfully.');
        process.exit(0);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Seed users failed:', e);
        process.exit(1);
    } finally {
        client.release();
        try {
            await db.pool.end();
        } catch (_) {
        }
    }
};

main();
