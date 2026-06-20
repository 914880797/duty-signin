import { jsonSuccess, jsonError } from '../_shared.js';

export async function onRequestPost({ env }) {
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
