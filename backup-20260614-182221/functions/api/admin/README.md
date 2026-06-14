# 管理员账号密码修改指南

## 📋 说明

本文档说明如何在忘记管理员密码时，通过 Git 修改密码配置。

## ⚠️ 重要提示

1. **密码经过哈希加密存储** - 配置文件中的密码会被 SHA-256+Salt 加密后存入数据库
2. **配置文件使用后立即删除** - 初始化完成后应删除 `admin-config.json` 避免密码泄露
3. **不要提交密码文件到 Git** - 只提交 `.example` 模板文件

## 🔧 修改密码步骤

### 方法一：通过配置文件修改（推荐）

#### 1. 创建配置文件

在本地创建 `functions/api/admin/admin-config.json` 文件：

```json
{
  "admins": [
    {
      "username": "admin",
      "password": "我的新密码",
      "is_active": true
    }
  ]
}
```

#### 2. 提交配置文件到 Git

```bash
git add functions/api/admin/admin-config.json
git commit -m "chore: 更新管理员密码配置"
git push origin main
```

#### 3. 运行初始化脚本

使用 `curl` 调用初始化 API：

```bash
curl -X POST https://your-domain.workers.dev/api/admin/init-config \
  -H "Content-Type: application/json" \
  -d '{
    "admins": [
      {
        "username": "admin",
        "password": "我的新密码",
        "is_active": true
      }
    ]
  }'
```

**成功响应：**
```json
{
  "success": true,
  "message": "成功初始化 1 个管理员账号",
  "count": 1
}
```

#### 4. 删除配置文件（重要！）

```bash
git rm functions/api/admin/admin-config.json
git commit -m "chore: 删除敏感配置文件"
git push origin main
```

---

### 方法二：直接调用 API 修改

如果已有管理员账号可以登录，可以直接调用 API：

```bash
curl -X POST https://your-domain.workers.dev/api/admin/init-config \
  -H "Content-Type: application/json" \
  -d '{
    "admins": [
      {
        "username": "admin",
        "password": "新密码",
        "is_active": true
      },
      {
        "username": "admin2",
        "password": "密码 2",
        "is_active": true
      }
    ]
  }'
```

---

## 🔐 安全建议

### 密码复杂度要求
- 至少 8 个字符
- 包含大小写字母
- 包含数字
- 包含特殊字符（!@#$%^&* 等）

### 示例强密码
```
Admin@2026#Duty
Secure$Pass123
MonkeyCode!888
```

### 多管理员账号
建议配置 2-3 个管理员账号，防止单个账号遗忘：

```json
{
  "admins": [
    {
      "username": "admin",
      "password": "主管理员密码",
      "is_active": true
    },
    {
      "username": "backup_admin",
      "password": "备用管理员密码",
      "is_active": true
    }
  ]
}
```

---

## 📁 文件说明

| 文件 | 说明 | 是否提交 Git |
|------|------|-------------|
| `admin-config.json.example` | 配置模板 | ✅ 是 |
| `admin-config.json` | 实际配置（含密码） | ❌ 否 |
| `login.js` | 认证 API | ✅ 是 |
| `init-config.js` | 初始化 API | ✅ 是 |

---

## 🆘 忘记密码怎么办？

1. 按照**方法一**创建新的配置文件
2. 提交到 Git 并触发部署
3. 调用初始化 API 重置密码
4. 删除配置文件

整个过程约 2-3 分钟即可恢复访问权限。

---

## 🛠️ 技术细节

### 密码加密方式
- 算法：SHA-256
- Salt：`monkeycode_salt_2026`
- 存储格式：64 位十六进制字符串

### 数据库表结构
```sql
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### API 端点
- **登录认证**: `POST /api/admin/login`
- **初始化配置**: `POST /api/admin/init-config`

---

## ✅ 验证登录

初始化完成后，访问 admin 页面：
1. 输入新的用户名和密码
2. 点击"登录"按钮
3. 成功登录后即可管理排班
