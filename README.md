# SVGShare

一个基于 Cloudflare 全栈的 SVG 托管与分享平台。

## 🎯 项目目的

为设计师和开发者提供一个**极简、快速、美观**的 SVG 文件托管与分享解决方案。

- **极简**: 无干扰的用户界面，专注于 SVG 内容本身
- **快速**: 利用 Cloudflare Edge 实现全球毫秒级加载
- **美观**: Future Tech 风格设计，提升分享体验

## ✨ 功能特性

### 用户功能
- 📤 拖拽/点击上传 SVG 文件 (最大 1MB)
- 🖼️ Bento Grid 布局展示文件缩略图
- ✏️ 重命名、删除文件
- 🔗 一键生成/关闭分享链接
- 📊 悬停查看文件元数据 (大小、尺寸、上传时间)
- 🚪 退出登录

### 管理员功能
- 👥 用户管理列表 (查看所有注册用户)
- 🔍 筛选与搜索用户 (按角色/状态)
- ✅ 审核新用户 (Pending -> Active)
- 🔒 锁定/解锁用户
- 🛡️ 初始化管理员账号

### 访客功能
- 🔍 交互式查看器：缩放、平移、重置
- ⬇️ 下载源文件

### 技术特性
- 🔒 GitHub OAuth 登录
- 🌐 Cloudflare Workers 边缘部署
- 💾 D1 数据库 + R2 对象存储
- 🎨 无构建前端 (原生 ES Modules)

## 🚀 部署步骤

### 前置要求
- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare 账号](https://dash.cloudflare.com/)
- [GitHub 账号](https://github.com/)

### 1. 克隆仓库

```bash
git clone https://github.com/your-username/svgshare.git
cd svgshare
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 D1 数据库

```bash
npx wrangler d1 create svgshare-db
```

将返回的 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "svgshare-db"
database_id = "<your-database-id>"
```

### 4. 创建 R2 存储桶

```bash
npx wrangler r2 bucket create svgshare-files
```

### 5. 初始化数据库

```bash
npx wrangler d1 execute svgshare-db --remote --file=schema.sql
```

### 6. 创建 GitHub OAuth App

1. 前往 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 **New OAuth App**
3. 填写：
   - **Application name**: SVGShare
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-domain.com/auth/callback`
4. 记录 `Client ID` 和 `Client Secret`

### 7. 配置 Secrets

在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 中设置：

1. 进入 **Workers & Pages** → **svgshare** → **Settings** → **Variables and Secrets**
2. 添加以下 Secrets：

| Name | Value |
|------|-------|
| `GITHUB_CLIENT_ID` | 你的 GitHub Client ID |
| `GITHUB_CLIENT_SECRET` | 你的 GitHub Client Secret |
| `JWT_SECRET` | 随机字符串 (可用 `openssl rand -base64 32` 生成) |
| `ADMIN_GITHUB_IDS` | 初始管理员的 GitHub 用户名列表 (逗号分隔), e.g. `user1,user2` |

### 8. 部署

```bash
npx wrangler deploy
```

### 9. (可选) 绑定自定义域名

在 Cloudflare Dashboard 中：
1. 进入 **Workers & Pages** → **svgshare**
2. 点击 **Settings** → **Triggers** → **Custom Domains**
3. 添加你的域名

## ⚠️ 注意事项

1. **Secrets 配置**: 
   - **不要**将 `GITHUB_CLIENT_ID` 等敏感信息放在 `wrangler.toml` 的 `[vars]` 中
   - 每次 `wrangler deploy` 时，`[vars]` 会覆盖 Dashboard 中的配置
   - 正确做法是在 Dashboard 中设置 Secrets

2. **用户权限与初始化**:
   - 设置 `ADMIN_GITHUB_IDS` 后，列表中的用户首次登录将自动获得 **Active Admin** 权限
   - 其他用户首次登录默认为 **Pending** 状态，需等待管理员审核后才可使用上传功能
   - 如果未设置 `ADMIN_GITHUB_IDS`，所有人均为 Pending 状态 (导致无法使用)，请务必设置
   - 设置方法: `npx wrangler secret put ADMIN_GITHUB_IDS`

3. **本地开发**:
   - 创建 `.dev.vars` 文件存放本地开发变量
   - 该文件已在 `.gitignore` 中，不会提交到仓库

4. **GitHub 自动部署**:
   - 在 Cloudflare Workers → Settings → Builds & Deployments 中连接 GitHub 仓库
   - 推送代码后将自动部署

## 📁 项目结构

```
svgshare/
├── src/
│   ├── worker.js       # Worker 入口
│   ├── auth.js         # GitHub OAuth
│   ├── db.js           # D1 操作
│   └── r2.js           # R2 操作
├── public/
│   ├── index.html      # 首页
│   ├── dashboard.html  # 用户/管理面板
│   ├── admin.html      # 管理员后台
│   ├── share.html      # 分享页
│   ├── css/
│   └── js/
│       ├── admin.js    # 管理员逻辑
│       ├── dashboard.js
├── schema.sql          # 数据库结构
├── wrangler.toml       # Cloudflare 配置
└── README.md
```

## 📜 License

MIT
