export async function onRequestGet({ env }) {
  try {
    await ensureTable(env);

    const { results } = await env.DB.prepare(`
      SELECT id, content, created_at FROM announcements
      WHERE is_active = 1
      ORDER BY created_at DESC
    `).all();

    return Response.json({ success: true, data: results || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    await ensureTable(env);

    const { content } = await request.json();
    if (!content || !content.trim()) {
      return Response.json({ error: '公告内容不能为空' }, { status: 400 });
    }

    const result = await env.DB.prepare(`
      INSERT INTO announcements (content) VALUES (?)
    `).bind(content.trim()).run();

    return Response.json({ success: true, id: result.meta?.last_row_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    await ensureTable(env);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return Response.json({ error: '缺少公告ID' }, { status: 400 });
    }

    await env.DB.prepare(`
      UPDATE announcements SET is_active = 0 WHERE id = ?
    `).bind(id).run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
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
