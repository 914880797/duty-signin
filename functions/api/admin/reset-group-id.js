import { jsonSuccess, jsonError, verifyAdmin } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const result = await env.DB.prepare(`
      UPDATE signin_records SET group_id = null WHERE group_id = 1
    `).run();
    
    return jsonSuccess({
      message: `已将 ${result.meta?.changes || '所有'} 条记录的 group_id 重置为 null`
    });
  } catch (error) {
    console.error('重置 group_id 失败:', error);
    return jsonError(error.message);
  }
}
