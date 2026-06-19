import { hashPassword, jsonSuccess, jsonError } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return jsonError('用户名和密码不能为空', 400);
    }

    const admin = await env.DB.prepare(
      `SELECT username, password_hash FROM admin_users WHERE username = ? AND is_active = 1`
    ).bind(username).first();

    if (!admin) return jsonError('用户名或密码错误', 401);

    const inputHash = await hashPassword(password);

    if (inputHash !== admin.password_hash) {
      return jsonError('用户名或密码错误', 401);
    }

    const token = await hashPassword(admin.username);

    return jsonSuccess({ message: '登录成功', username, token });
  } catch (error) {
    console.error('Admin login error:', error);
    return jsonError(error.message);
  }
}
