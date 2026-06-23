import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    await ensureTable(env);

    const { results } = await env.DB.prepare(`
      SELECT id, content, created_at FROM announcements
      WHERE is_active = 1
      ORDER BY created_at DESC
    `).all();

    return jsonSuccess({ data: results || [] });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    await ensureTable(env);

    const { content } = await request.json();
    if (!content || !content.trim()) {
      return jsonError('公告内容不能为空', 400);
    }

    const result = await env.DB.prepare(`
      INSERT INTO announcements (content) VALUES (?)
    `).bind(content.trim()).run();

    return jsonSuccess({ id: result.meta?.last_row_id });
  } catch (error) {
    return jsonError(error.message);
  }
}

export async function onRequestDelete({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    await ensureTable(env);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return jsonError('缺少公告ID', 400);
    }

    await env.DB.prepare(`
      UPDATE announcements SET is_active = 0 WHERE id = ?
    `).bind(id).run();

    return jsonSuccess({});
  } catch (error) {
    return jsonError(error.message);
  }
}

async function ensureTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}
