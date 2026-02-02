const db = require('./src/database/db');

(async () => {
  const tables = [
    'performance_appraisals',
    'appraisal_development_plans',
    'appraisal_kra_scores',
    'performance_section_scores',
    'performance_section_score'
  ];

  const reg = await db.query(
    `SELECT ${tables
      .map((t) => `to_regclass('public.${t}') as ${t.replace(/[^a-zA-Z0-9_]/g, '_')}`)
      .join(', ')}`
  );
  console.log('\n== to_regclass ==');
  console.log(reg.rows[0]);

  for (const t of tables) {
    try {
      const cols = await db.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='${t}'
         ORDER BY ordinal_position`
      );
      console.log(`\n== columns: ${t} ==`);
      console.log(cols.rows);
    } catch (e) {
      console.log(`\n== columns: ${t} (error) ==`);
      console.log(e.message);
    }
  }

  const latest = await db.query('SELECT id FROM performance_appraisals ORDER BY id DESC LIMIT 1');
  const latestId = latest.rows[0]?.id;
  console.log('\nlatest performance_appraisals id:', latestId);

  if (latestId) {
    try {
      const dp = await db.query(
        'SELECT * FROM appraisal_development_plans WHERE appraisal_id = $1 ORDER BY id DESC LIMIT 10',
        [latestId]
      );
      console.log('\n== dev plans (latest appraisal) ==');
      console.log(dp.rows);
    } catch (e) {
      console.log('\n== dev plans (latest appraisal) error ==');
      console.log(e.message);
    }

    try {
      const aks = await db.query(
        'SELECT * FROM appraisal_kra_scores WHERE appraisal_id = $1 ORDER BY id DESC LIMIT 10',
        [latestId]
      );
      console.log('\n== kra scores (latest appraisal) ==');
      console.log(aks.rows);
    } catch (e) {
      console.log('\n== kra scores (latest appraisal) error ==');
      console.log(e.message);
    }
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
