// 清空所有打卡记录
export async function onRequestPost({ env }) {
  try {
    await env.DB.prepare(`DELETE FROM signin_records`).run();
    
    return Response.json({
      success: true,
      message: '已清空所有打卡记录'
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// 获取打卡周期设置
export async function onRequestGet({ env }) {
  try {
    const config = await env.DB.prepare(`
      SELECT value FROM settings WHERE key = 'cycle_start_date'
    `).first();
    
    const count = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM signin_records
    `).first();
    
    return Response.json({
      success: true,
      cycleStartDate: config?.value || null,
      totalRecords: count?.total || 0
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// 保存打卡周期设置
export async function onRequestPut({ request, env }) {
  try {
    const { cycleStartDate } = await request.json();
    
    if (!cycleStartDate) {
      return Response.json({ error: '缺少起始日期' }, { status: 400 });
    }
    
    await env.DB.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at) 
      VALUES ('cycle_start_date', ?, CURRENT_TIMESTAMP)
    `).bind(cycleStartDate).run();
    
    return Response.json({
      success: true,
      message: '打卡周期设置已保存'
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
