// 管理员认证 API
export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return Response.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }
    
    console.log('Login attempt:', { username, passwordLength: password.length });
    
    // 从数据库查询管理员配置
    const admin = await env.DB.prepare(`
      SELECT username, password_hash FROM admin_users WHERE username = ? AND is_active = 1
    `).bind(username).first();
    
    console.log('Database query result:', admin);
    
    if (!admin) {
      console.log('User not found or inactive');
      return Response.json({ error: '用户名或密码错误' }, { status: 401 });
    }
    
    // 验证密码（简单哈希对比）
    const inputHash = await hashPassword(password, 'monkeycode_salt_2026');
    console.log('Password hash comparison:', {
      inputHash,
      storedHash: admin.password_hash,
      match: inputHash === admin.password_hash
    });
    
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
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 简单的密码哈希函数（SHA-256 + salt）
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
