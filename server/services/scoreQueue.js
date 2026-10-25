const { sequelize, Score } = require('../models');
const { scoreApplication } = require('./scoringService');

// Postgres-backed job queue. The Score row IS the job: status 'pending' means
// queued, 'processing' means a loop has claimed it, 'done'/'failed' are final.
// Replaces SQS + the separate worker, because Render has no free worker tier.
//
// Upload returns immediately after setting status to 'pending'; this loop
// picks it up in the background, so the request cycle is still decoupled
// from the slow embedding work.

const POLL_INTERVAL_MS = 3000;
let busy = false;

// Claims the oldest pending row and flips it to 'processing' inside one
// transaction. FOR UPDATE SKIP LOCKED means two loops (if this ever runs on
// more than one instance) can never claim the same row.
const claimNext = () =>
  sequelize.transaction(async (t) => {
    const next = await Score.findOne({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']],
      lock: t.LOCK.UPDATE,
      skipLocked: true,
      transaction: t
    });
    if (!next) return null;
    await next.update({ status: 'processing' }, { transaction: t });
    return next.application_id;
  });

const tick = async () => {
  if (busy) return; // one pass at a time per process
  busy = true;
  try {
    let applicationId = await claimNext();
    while (applicationId !== null) {
      try {
        await scoreApplication(applicationId);
        console.log(`[scoreQueue] scored application ${applicationId}`);
      } catch (err) {
        console.error(`[scoreQueue] application ${applicationId} failed:`, err.message);
        // scoreApplication marks most failures itself, but errors thrown before
        // its own try block would leave the row stuck in 'processing'.
        await Score.update(
          { status: 'failed', error_message: err.message },
          { where: { application_id: applicationId, status: 'processing' } }
        );
      }
      // Failed rows stay failed: no infinite retry, unlike an SQS message
      // with no dead-letter queue.
      applicationId = await claimNext();
    }
  } catch (err) {
    console.error('[scoreQueue] poll error:', err.message);
  } finally {
    busy = false;
  }
};

const startScoreQueue = async () => {
  try {
    // A restart mid-scoring (Render can restart free services at any time)
    // leaves rows stuck in 'processing' with nothing working on them.
    // Safe only while there is a single instance; with several you'd need a
    // heartbeat or a claimed-at timestamp instead.
    await Score.update({ status: 'pending' }, { where: { status: 'processing' } });
  } catch (err) {
    console.error('[scoreQueue] could not reset stuck jobs:', err.message);
  }
  setInterval(tick, POLL_INTERVAL_MS);
  tick();
};

// kick() lets the upload handler start scoring immediately instead of
// waiting up to POLL_INTERVAL_MS for the next poll.
module.exports = { startScoreQueue, kick: tick };