# AI 小说阅读与改写

一个本地运行的在线阅读网页，支持上传 TXT 小说、设置阅读字体和配色、用 DeepSeek API 改写选中文本，并保存每次改写版本。

## 运行

```bash
npm install
npm start
```

打开 `http://localhost:3000`。

## 数据

- `data/users.json` 只保存账号索引、密码哈希和登录 session
- 每个用户的数据独立保存在 `data/users/<userId>/`
- 用户配置保存在 `data/users/<userId>/config.json`
- 用户日志保存在 `data/users/<userId>/logs.json`
- 用户书库摘要保存在 `data/users/<userId>/library.json`
- 每本书正文、版本和附属信息单独保存在 `data/users/<userId>/books/<bookId>.json`
- 旧版内嵌在 `data/users.json` 的配置、日志和书籍会在启动时自动拆分迁移
- 旧版 `data/library.json` 和 `data/config.json` 会在创建首个用户时迁入该用户
- `data/*.json` 已加入 `.gitignore`，避免误提交小说文本或 API Key

## DeepSeek 配置

在右侧“接口设置”里保存：

- API Key
- Base URL，默认 `https://api.deepseek.com`
- 模型，默认 `deepseek-v4-flash`
- 温度、最大输出、思考模式、思考模式强度（low / high / max）
- 多条改写系统级提示词
- 附属信息提取提示词，可分别配置提取 System、故事背景、角色设定、情节发展

## 文档附属信息

打开书籍版本后，可在右侧“附属信息”里维护：

- 全文故事背景
- 角色设定
- 情节发展

可以手工编辑并保存，也可以点击“从当前版本提取”调用 DeepSeek 从当前版本全文提取。后续每次 AI 改写都会自动携带这些附属信息，用于保持世界观、人物和情节一致。

大文本会按约 10 万字自动分块提取，避免一次性请求过大导致 DeepSeek 网关返回 413。多段提取会并发调用接口，返回后统一合并；角色信息按角色名归并，并保留背景描述、性格特点、人设风格、人物关系、能力限制等字段。普通 TXT 阅读也按约 10 万字分段渲染，阅读区上方会显示当前段数，可用“上一段 / 下一段”切换，减少浏览器一次性排版全文的卡顿。
