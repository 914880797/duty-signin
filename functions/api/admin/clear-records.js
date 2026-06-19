import { verifyAdmin, jsonSuccess, jsonError } from '../_shared.js';

export async function onRequestPost({ env, request }) {
  try {
    if (!await verifyAdmin(request, env)) {
      return jsonError('未授权访问', 401);
    }

    const result = await env.DB.prepare(`DELETE FROM signin_records`).run();

    return jsonSuccess({ message: '已清空所有打卡记录', deletedCount: result.meta?.changes || 0 });
  } catch (error) {
    console.error('清空记录失败:', error);
    return jsonError(error.message);
  }
}
