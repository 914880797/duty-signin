export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const name = searchParams.get('name');
  const groupId = searchParams.get('group_id');

  let sql = `
    SELECT dc.duty_date, dc.duty_time, dc.name, dc.group_id, sg.name as group_name
    FROM duty_config dc
    LEFT JOIN signin_records sr ON dc.name = sr.name AND dc.duty_date = sr.duty_date AND dc.duty_time = sr.duty_time
    LEFT JOIN shift_groups sg ON dc.group_id = sg.id
    WHERE sr.id IS NULL
      AND dc.duty_time IS NOT NULL
      AND dc.duty_time != ''
      AND dc.duty_time != '未安排'
  `;
  const args = [];

  if (startDate) {
    sql += ' AND dc.duty_date >= ?';
    args.push(startDate);
  }
  if (endDate) {
    sql += ' AND dc.duty_date <= ?';
    args.push(endDate);
  }
  if (name) {
    sql += ' AND dc.name LIKE ?';
    args.push('%' + name + '%');
  }
  if (groupId) {
    sql += ' AND dc.group_id = ?';
    args.push(groupId);
  }

  sql += ' ORDER BY dc.duty_date DESC, dc.duty_time, dc.name';

  try {
    const { results } = await env.DB.prepare(sql).bind(...args).all();

    return Response.json({
      success: true,
      data: results || []
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
