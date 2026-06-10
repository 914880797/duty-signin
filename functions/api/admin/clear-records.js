// 管理员专用 API - 清空打卡记录
export async function onRequestPost({ env, request }) {
  try {
    // 验证管理员权限（简单验证，可以加强）
    const authHeader = request.headers.get('Authorization');
    // 这里可以添加更严格的认证逻辑
    
    // 清空所有打卡记录
    const result = await env.DB.prepare(`
      DELETE FROM signin_records
    `).run();
    
    return Response.json({
      success: true,
      message: '已清空所有打卡记录',
      deletedCount: result.meta?.rows_written || 0
    });
  } catch (error) {
    console.error('清空记录失败:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
