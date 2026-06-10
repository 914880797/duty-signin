export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const time = searchParams.get('time');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const dutyTime = searchParams.get('duty_time');

  let sql = `
    SELECT sr.*, sg.name as group_name 
    FROM signin_records sr 
    LEFT JOIN shift_groups sg ON sr.group_id = sg.id 
    WHERE 1=1
  `;
  const args = [];
  
  if (date) { 
    sql += ` AND sr.duty_date=?`; 
    args.push(date); 
  }
  if (startDate) { 
    sql += ` AND sr.duty_date>=?`; 
    args.push(startDate); 
  }
  if (endDate) { 
    sql += ` AND sr.duty_date<=?`; 
    args.push(endDate); 
  }
  if (time || dutyTime) { 
    sql += ` AND sr.duty_time=?`; 
    args.push(time || dutyTime); 
  }
  
  sql += ` ORDER BY sr.created_at DESC`;

  const { results } = await env.DB.prepare(sql).bind(...args).all();
  
  return Response.json({
    success: true,
    data: results || [],
    count: results ? results.length : 0
  });
}