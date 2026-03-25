const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Diagnostic: log redacted DATABASE_URL to help debug connection issues
const rawUrl = process.env.DATABASE_URL || '';
if (!rawUrl) {
    console.error('❌ DATABASE_URL environment variable is NOT set. Exiting.');
    process.exit(1);
}
try {
    const parsed = new URL(rawUrl);
    const redacted = `${parsed.protocol}//${parsed.username}:****@${parsed.host}${parsed.pathname}`;
    console.log(`🔗 DATABASE_URL (redacted): ${redacted}`);
} catch (e) {
    console.error('❌ DATABASE_URL is malformed:', e.message);
    process.exit(1);
}

const db = require('../database/db');

const readSqlFile = (absolutePath) => {
    return fs.readFileSync(absolutePath, 'utf8');
};

const resolveRepoRoot = () => {
    const candidates = [];

    // Typical local / Render when Root Directory = backend
    candidates.push(path.resolve(process.cwd(), '..'));
    // When Root Directory is nested (e.g. src/backend)
    candidates.push(path.resolve(process.cwd(), '../..'));
    // When running from repo root
    candidates.push(process.cwd());

    // Fallbacks based on script location
    candidates.push(path.resolve(__dirname, '../../../'));
    candidates.push(path.resolve(__dirname, '../../../../'));

    for (const c of candidates) {
        try {
            if (fs.existsSync(path.join(c, 'database', 'schema.sql'))) {
                return c;
            }
        } catch (_) {
            // ignore
        }
    }

    return candidates[0];
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

        const repoRoot = resolveRepoRoot();

        const schemaSql = path.join(repoRoot, 'database', 'schema.sql');
        const seedAdminSql = path.join(repoRoot, 'database', 'seed_admin.sql');
        const createMessagesSql = path.join(repoRoot, 'database', 'create_messages_table.sql');
        const addUserFieldsSql = path.join(repoRoot, 'database', 'add_user_fields.sql');
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
