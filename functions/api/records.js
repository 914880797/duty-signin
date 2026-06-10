export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const time = searchParams.get('time');

  let whereClause = 'WHERE 1=1';
  const args = [];
  
  if (date) {
    whereClause += ' AND duty_date=?';
    args.push(date);
  }
  if (time) {
    whereClause += ' AND duty_time=?';
    args.push(time);
  }

  const sql = `SELECT * FROM signin_records ${whereClause} ORDER BY created_at DESC`;
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  
  return Response.json({
    success: true,
    data: results || [],
    count: results ? results.length : 0
  });
}