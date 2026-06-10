export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const time = searchParams.get('time');

  let sql = `SELECT * FROM signin_records WHERE 1=1`;
  const args = [];
  if (date) { sql += ` AND duty_date=?`; args.push(date); }
  if (time) { sql += ` AND duty_time=?`; args.push(time); }
  sql += ` ORDER BY created_at DESC`;

  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return Response.json(results);
}