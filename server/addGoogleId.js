// One-off migration, run as a throwaway ECS task (same pattern as
// seedRoles.js / checkSchema.js) because RDS is private.
//
// Safe to run more than once: every statement is idempotent, and the whole
// thing runs in one transaction, so it either fully applies or changes nothing.
// No rows are modified. Existing users keep their values; google_id is simply
// null for them.

const { sequelize, User } = require('./models');

(async () => {
  try {
    const qi = sequelize.getQueryInterface();
    const tableName = User.getTableName();
    const plainName = typeof tableName === 'string' ? tableName : tableName.tableName;
    const table = qi.quoteIdentifier(plainName);

    const showColumns = async (label) => {
      const [rows] = await sequelize.query(
        `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
          WHERE table_name = :t
          ORDER BY ordinal_position`,
        { replacements: { t: plainName } }
      );
      console.log(`${label} columns on "${plainName}":`);
      console.log(JSON.stringify(rows, null, 2));
    };

    await showColumns('BEFORE:');

    await sequelize.transaction(async (t) => {
      const statements = [
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`,
        // Google-only users have no password, and start with no role.
        `ALTER TABLE ${table} ALTER COLUMN password_hash DROP NOT NULL`,
        `ALTER TABLE ${table} ALTER COLUMN role_id DROP NOT NULL`,
        // Same index name Sequelize generates from the model's `indexes`
        // option, so sync({ alter: true }) sees it and doesn't add a duplicate.
        // Postgres unique indexes allow many NULLs, so existing users are fine.
        `CREATE UNIQUE INDEX IF NOT EXISTS users_google_id ON ${table} (google_id)`
      ];
      for (const sql of statements) {
        console.log(`Running: ${sql}`);
        await sequelize.query(sql, { transaction: t });
      }
    });

    await showColumns('AFTER:');
    console.log('Migration complete.');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1); // non-zero so the ECS task shows as failed in the console
  }
})();