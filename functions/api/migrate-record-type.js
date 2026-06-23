import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
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
