const fs = require('fs');
const path = require('path');

require('dotenv').config();

const db = require('../database/db');

const readSqlFile = (absolutePath) => {
    return fs.readFileSync(absolutePath, 'utf8');
};

const runSqlFile = async (absolutePath) => {
    const sql = readSqlFile(absolutePath);
    console.log(`\n🟦 Running: ${path.relative(process.cwd(), absolutePath)}`);
    await db.query(sql);
    console.log(`✅ Completed: ${path.basename(absolutePath)}`);
};

const main = async () => {
    try {
        const autoInit = String(process.env.AUTO_INIT_DB || '').toLowerCase() === 'true';
        if (!autoInit) {
            console.log('AUTO_INIT_DB is not true. Skipping DB initialization.');
            process.exit(0);
        }

        // Only run destructive schema.sql when DB looks empty
        const coreTables = [
            'roles',
            'departments',
            'users',
            'staff_profiles',
            'leave_types',
            'leave_requests',
            'system_settings',
            'appraisals',
            'appraisal_scores',
            'audit_logs'
        ];

        const existsRes = await db.query(
            `SELECT COUNT(*)::int AS count
             FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = ANY($1::text[])`,
            [coreTables]
        );

        const existingCount = existsRes.rows[0]?.count ?? 0;
        const looksEmpty = existingCount === 0;

        const repoRoot = path.resolve(__dirname, '../../../../');

        const schemaSql = path.join(repoRoot, 'database', 'schema.sql');
        const seedAdminSql = path.join(repoRoot, 'database', 'seed_admin.sql');
        const createMessagesSql = path.join(repoRoot, 'database', 'create_messages_table.sql');
        const addUserFieldsSql = path.join(repoRoot, 'database', 'add_user_fields.sql');
        const addCeoApprovalSql = path.join(repoRoot, 'database', 'add_ceo_approval_column.sql');
        const appraisalMigrationSql = path.join(repoRoot, 'backend', 'src', 'database', 'appraisal_migration.sql');
        const performanceSectionsSql = path.join(repoRoot, 'backend', 'src', 'database', 'performance_sections_migration.sql');

        if (looksEmpty) {
            console.log('🟨 Database looks empty (no core tables found). Running base schema + migrations...');
            await runSqlFile(schemaSql);
        } else {
            console.log(
                `🟨 Database is NOT empty (${existingCount} core tables already exist). ` +
                'Skipping database/schema.sql to avoid destructive drops.'
            );
        }

        // Non-destructive / idempotent steps
        await runSqlFile(createMessagesSql);
        await runSqlFile(addUserFieldsSql);
        await runSqlFile(addCeoApprovalSql);
        await runSqlFile(appraisalMigrationSql);
        await runSqlFile(performanceSectionsSql);

        // Ensure Super Admin exists
        await runSqlFile(seedAdminSql);

        console.log('\n✅ DB initialization complete.');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ DB initialization failed:', err);
        process.exit(1);
    } finally {
        try {
            await db.pool.end();
        } catch (_) {
            // ignore
        }
    }
};

main();
