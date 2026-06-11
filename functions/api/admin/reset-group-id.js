// 重置所有打卡记录的 group_id 为 null
export async function onRequestPost({ env }) {
  try {
    const result = await env.DB.prepare(`
      UPDATE signin_records SET group_id = null WHERE group_id = 1
    `).run();
    
    console.log('重置 group_id 结果:', result);
    
    return Response.json({
      success: true,
      message: `已将 ${result.meta?.changes?.rows_written || '所有'} 条记录的 group_id 重置为 null`
    });
  } catch (error) {
    console.error('重置 group_id 失败:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
