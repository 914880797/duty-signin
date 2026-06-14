// 获取所有不重复的值班时段
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT DISTINCT duty_time as time_slot 
      FROM duty_config 
      ORDER BY duty_time ASC
    `).all();
    
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
