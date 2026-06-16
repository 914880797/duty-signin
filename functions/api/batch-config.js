export async function onRequestPost({ request, env }) {
  try {
    const { names, duty_date, duty_time, group_id } = await request.json();

    if (!names || !Array.isArray(names) || names.length === 0) {
      return Response.json({ error: '人员名单不能为空' }, { status: 400 });
    }
    if (!duty_date) {
      return Response.json({ error: '日期不能为空' }, { status: 400 });
    }
    if (!duty_time) {
      return Response.json({ error: '时段不能为空' }, { status: 400 });
    }

    let inserted = 0;
    let skipped = 0;
    const stmt = env.DB.prepare(`
      INSERT OR IGNORE INTO duty_config (duty_date, duty_time, name, group_id)
      VALUES (?, ?, ?, ?)
    `);

    const batch = [];
    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      batch.push(stmt.bind(duty_date, duty_time, trimmed, group_id || null));
    }

    const results = await env.DB.batch(batch);
    inserted = results.filter(r => r.meta?.changes > 0).length;
    skipped = results.length - inserted;

    return Response.json({
      success: true,
      inserted,
      skipped,
      total: names.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
