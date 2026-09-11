# 深读 (Deep Read)

一个智能 PDF 深度阅读平台：自动解析章节，用大模型生成导读，并与导师一起精读。

## 功能特性

- 📚 **智能章节解析**: 先按标题规则识别章节，再用大模型重新划分目录
- 🧠 **本章导读**: 根据原文生成摘要、关键要点和思考题
- 👨‍🏫 **导师陪学**: 苏格拉底 / 费曼 / 诸葛亮，基于章节原文流式对话
- 🏷️ **阅读分类**: 支持教材、工作材料、兴趣读物三种类型
- ✏️ **手动编辑**: 可手动调整章节标题和页码范围
- 🎨 **优雅界面**: 奶白羊皮纸风格，适合长时间阅读
- 📱 **响应式设计**: 支持桌面和移动设备

## 技术栈

- **前端**: Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- **数据库**: SQLite + Prisma ORM
- **PDF处理**: unpdf
- **大模型**: 兼容 OpenAI Chat Completions 的接口（DeepSeek / 通义 / Moonshot / OpenAI 等）

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装步骤

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量（可选）**
   ```bash
   cp .env.example .env
   ```
   也可启动后再打开 [模型设置](/settings) 填写 API Key。若 `.env` 中设置了 `LLM_API_KEY`，将优先于页面配置。

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

   打开 [http://localhost:3000](http://localhost:3000) 查看应用，先到「模型设置」接入大模型。

### 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── documents/         # 文档页面
│   ├── settings/          # 大模型设置
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   └── ui/               # shadcn/ui 组件
├── lib/                  # 工具库
│   ├── llm.ts            # 大模型客户端
│   ├── insight.ts        # 导读与目录提示词
│   └── prisma.ts         # Prisma 客户端
└── generated/            # Prisma 生成的文件
prisma/
├── schema.prisma         # 数据库模式
└── migrations/           # 数据库迁移
uploads/                  # PDF文件存储
```

## 使用说明

### 1. 接入大模型

- 打开「模型设置」，选择 DeepSeek / 通义千问 / 月之暗面 / SiliconFlow / OpenAI
- 填写 API Key、接口地址和模型名称，可先「测试连接」再保存
- 导师陪学、章节导读、智能目录都依赖此项

### 2. 上传PDF文档

- 在首页选择阅读类型（教材/工作材料/兴趣读物）
- 拖拽或点击上传PDF文件（最大10MB）
- 系统会自动解析章节结构；解析较粗时可点「用大模型划分章节」

### 3. 章节导读与陪学

- 选择章节后生成导读（摘要、要点、思考题）
- 点击导师卡片开始对话，回答会按章节原文流式返回
- 使用编辑按钮调整章节标题和页码范围

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

### 生成章节导读
```
POST /api/documents/[id]/chapters/[chapterId]/insight
```

### 导师陪学（SSE）
```
POST /api/documents/[id]/learn
```

### 大模型设置
```
GET/PUT /api/settings
POST /api/settings/test
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
- source: 来源 (auto|manual|llm)
- summary / keyPoints / questions: 大模型导读

### 环境变量

参考 `.env.example` 文件配置必要的环境变量。未配置时，可在应用内的「模型设置」页填写。

## 路线图

- ✅ P0: 基础PDF上传和章节解析
- ✅ P1: 导师对话系统（大模型流式陪学）
- ✅ P1.5: 章节导读与智能目录
- 📋 P2: 阅读记录和进度跟踪
- 📋 P3: 高级分析和总结功能

## 许可证

MIT License
