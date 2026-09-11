# 深读 (Deep Read)

一个智能PDF深度阅读平台，支持文档章节自动解析和深度阅读体验。

## 功能特性

- 📚 **智能章节解析**: 自动识别PDF文档章节结构
- 🏷️ **阅读分类**: 支持教材、工作材料、兴趣读物三种类型
- ✏️ **手动编辑**: 可手动调整章节标题和页码范围
- 🎨 **优雅界面**: 奶白羊皮纸风格，适合长时间阅读
- 📱 **响应式设计**: 支持桌面和移动设备

## 技术栈

- **前端**: Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- **数据库**: SQLite + Prisma ORM
- **PDF处理**: unpdf
- **文件上传**: 原生FormData + multer

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装步骤

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env
   ```

3. **初始化数据库**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **访问应用**
   
   打开 [http://localhost:3000](http://localhost:3000) 查看应用

### 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── documents/         # 文档页面
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   └── ui/               # shadcn/ui 组件
├── lib/                  # 工具库
│   └── prisma.ts         # Prisma 客户端
└── generated/            # Prisma 生成的文件
prisma/
├── schema.prisma         # 数据库模式
└── migrations/           # 数据库迁移
uploads/                  # PDF文件存储
```

## 使用说明

### 1. 上传PDF文档

- 在首页选择阅读类型（教材/工作材料/兴趣读物）
- 拖拽或点击上传PDF文件（最大10MB）
- 系统会自动解析章节结构

### 2. 章节管理

- 查看自动解析的章节列表
- 点击章节进行阅读
- 使用编辑按钮调整章节标题和页码范围

### 3. 阅读体验

- 左侧章节导航，右侧内容展示
- 支持章节间快速切换
- 预留导师卡片位置（P1功能）

## API 文档

### 上传文档
```
POST /api/documents
Content-Type: multipart/form-data

Body:
- file: PDF文件
- intent: 阅读类型 (academic|work|interest)
```

### 获取文档
```
GET /api/documents/[id]
```

### 更新章节
```
PATCH /api/documents/[id]/chapters/[chapterId]
Content-Type: application/json

Body:
{
  "title": "章节标题",
  "pageStart": 1,
  "pageEnd": 10
}
```

## 开发说明

### 数据库模型

**Document (文档)**
- id: 唯一标识
- title: 文档标题
- filePath: 文件路径
- pageCount: 页数
- intent: 阅读类型
- parseStatus: 解析状态 (pending|ok|poor|failed)
- clientId: 客户端标识
- createdAt: 创建时间

**Chapter (章节)**
- id: 唯一标识
- documentId: 所属文档ID
- index: 章节索引
- title: 章节标题
- pageStart: 起始页码
- pageEnd: 结束页码
- text: 章节内容
- source: 来源 (auto|manual)

### 环境变量

参考 `.env.example` 文件配置必要的环境变量。

## 路线图

- ✅ P0: 基础PDF上传和章节解析
- 🔄 P1: 导师对话系统
- 📋 P2: 阅读记录和进度跟踪
- 📋 P3: 高级分析和总结功能

## 许可证

MIT License