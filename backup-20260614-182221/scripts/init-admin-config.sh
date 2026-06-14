#!/bin/bash

# 初始化管理员账号配置脚本
# 使用说明：
# 1. 创建配置文件：functions/api/admin/admin-config.json
# 2. 运行此脚本：./scripts/init-admin-config.sh
# 3. 删除配置文件：rm functions/api/admin/admin-config.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/functions/api/admin/admin-config.json"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在：$CONFIG_FILE"
    echo ""
    echo "请先创建配置文件："
    echo "  复制 functions/api/admin/admin-config.json.example"
    echo "  修改 username 和 password 为你的账号密码"
    exit 1
fi

# 读取配置
echo "📋 读取配置文件..."
USERNAME=$(jq -r '.admins[0].username' "$CONFIG_FILE")
PASSWORD=$(jq -r '.admins[0].password' "$CONFIG_FILE")

echo "👤 管理员账号：$USERNAME"
echo ""

# 检查是否部署了项目
echo "🚀 正在初始化管理员配置..."
echo ""

# 使用 curl 调用初始化 API
# 注意：需要替换 YOUR_DOMAIN 为实际的 Cloudflare Pages 域名
DOMAIN="${CF_PAGES_DOMAIN:-http://localhost:8788}"

RESPONSE=$(curl -s -X POST "$DOMAIN/api/admin/init-config" \
  -H "Content-Type: application/json" \
  -d @"$CONFIG_FILE")

echo "📡 API 响应："
echo "$RESPONSE" | jq .

# 检查是否成功
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo ""
    echo "✅ 管理员配置初始化成功！"
    echo ""
    echo "⚠️  重要：请立即删除配置文件避免密码泄露："
    echo "   git rm functions/api/admin/admin-config.json"
    echo "   git commit -m 'chore: 删除敏感配置文件'"
    echo "   git push origin main"
    echo ""
    echo "🔐 使用新密码登录 admin 页面即可"
else
    echo ""
    echo "❌ 初始化失败，请检查错误信息"
    exit 1
fi
