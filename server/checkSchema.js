// One-off diagnostic — run this via a throwaway ECS task (same pattern as
// seedRoles.js) to confirm sync({ alter: true }) actually applied the new
// JobListing columns/indexes to RDS, without needing to make RDS public
// or connect from your laptop at all.

const { sequelize, JobListing } = require('./models');

(async () => {
  try {
    const qi = sequelize.getQueryInterface();
    const tableName = JobListing.getTableName();

    const columns = await qi.describeTable(tableName);
    console.log(`Columns on "${tableName}":`);
    console.log(JSON.stringify(Object.keys(columns), null, 2));
    console.log('Full column detail:');
    console.log(JSON.stringify(columns, null, 2));

    const indexes = await qi.showIndex(tableName);
    console.log(`Indexes on "${tableName}":`);
    console.log(JSON.stringify(indexes.map((i) => ({ name: i.name, fields: i.fields })), null, 2));
  } catch (err) {
    console.error('Schema check failed:', err.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
})();