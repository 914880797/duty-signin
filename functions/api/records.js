export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const time = searchParams.get('time');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const dutyTime = searchParams.get('duty_time');
  const groupId = searchParams.get('group_id');
  const name = searchParams.get('name');

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
  if (groupId) {
    sql += ` AND sr.group_id=?`;
    args.push(groupId);
  }
  if (name) {
    sql += ` AND sr.name LIKE ?`;
    args.push(`%${name}%`);
  }
  
  sql += ` ORDER BY sr.created_at DESC`;

  try {
    const { results } = await env.DB.prepare(sql).bind(...args).all();
    
    return Response.json(results || [], {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}