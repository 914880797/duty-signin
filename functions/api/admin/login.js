// 管理员认证 API
export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return Response.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }
    
    // 从数据库查询管理员配置
    const admin = await env.DB.prepare(`
      SELECT username, password_hash FROM admin_users WHERE username = ? AND is_active = 1
    `).bind(username).first();
    
    if (!admin) {
      return Response.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    
    // 生成输入密码的哈希
    const inputHash = await hashPassword(password, 'monkeycode_salt_2026');
    
    // 对比哈希值
    if (inputHash !== admin.password_hash) {
      return Response.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    
    return Response.json({
      success: true,
      message: '登录成功',
      username: username
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// SHA-256 + salt 密码哈希
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
