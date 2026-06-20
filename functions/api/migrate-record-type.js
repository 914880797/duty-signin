import { jsonSuccess, jsonError } from './_shared.js';

export async function onRequestPost({ env }) {
  try {
    const check = await env.DB.prepare(
      `PRAGMA table_info(signin_records)`
    ).all();

    const hasRecordType = check.results?.some(c => c.name === 'record_type');

    if (!hasRecordType) {
      await env.DB.prepare(
        `ALTER TABLE signin_records ADD COLUMN record_type TEXT DEFAULT 'signin'`
      ).run();

      await env.DB.prepare(
        `UPDATE signin_records SET record_type = 'makeup' WHERE ip_address = 'makeup'`
      ).run();
    }

    return jsonSuccess({ message: 'record_type 列已就绪', migrated: !hasRecordType });
  } catch (error) {
    return jsonError(error.message);
  }
}
