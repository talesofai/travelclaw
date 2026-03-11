---
name: travelclaw
description: |
  让 Neta 角色踏上随机冒险之旅 —— 每次一站，看图、决定要不要继续，集满 5 站可生成旅行图鉴。

  **主动触发时机（无需用户明确要求）：**
  - 刚完成 adopt 领养角色后，主动提议让 TA 去旅行
  - 对话中出现：旅行 / travel / 出发 / 去探索 / 随机玩玩 / 带我去
  - 用户说"再来一些"、"继续"且上下文是旅行图片时

  **前置条件：** 已有 SOUL.md（含角色名 + 形象图片字段）；已配置 neta-skills。
  **无需安装任何额外工具。**
  **响应原则：每完成一个操作步骤立即输出反馈，不要等所有步骤都完成后再统一回复。**
  **速度原则：全程加速推进，不空转等待。轮询图片生成时持续检查状态，若超过 30 秒未完成，立即向用户输出等待提示。**
  **语言原则：根据用户触发时使用的语言（中文 / 英文 / 其他）判断偏好语言，全程使用同一语言回复，除非用户明确要求切换。**
  **交互原则：所有询问下一步的选项，必须以可点击的快捷回复按钮形式呈现。点击后自动发送 `@{bot_name} {选项内容}`。bot_name 从当前对话上下文中获取。**
---

# Neta Travel — 角色旅行冒险

让 Neta 角色自动旅行 —— 随机发现平台玩法，生成旅行图，集满 5 站输出互动 HTML 图鉴。

**相关项目：** [neta-skills](https://github.com/talesofai/neta-skills) — Neta 平台 API 工具集

---

## 游戏概念

Neta 世界拥有 **500+ 个随机场景**，每一站都是未知的相遇。
角色与玩法碰撞，生成独一无二的旅行图。

**集满 5 站，解锁专属旅行图鉴** —— 用互动世界地图永久封存这段冒险。
探索得越多，地图越完整，Neta 世界在你眼前徐徐展开。

> 🎯 核心目标：5 站 → 图鉴。每一站都是通往图鉴的一步，世界那么大，多探索几站！

---

## 语言判断

**在开场第一句话之前**，根据用户触发时使用的文字判断偏好语言：
- 触发词为中文 → 全程中文
- 触发词为英文 → 全程英文
- 其他语言 → 跟随用户语言

**此后所有输出（包括固定模板文案）均使用该语言**，直到用户明确说"切换语言"/"switch language"等才更换。

---

## 开场：介绍 + 确认角色

从 SOUL.md 读取角色名与形象图片 UUID（`形象图片` URL 中的 UUID 段）。

> ⚠️ `形象图片` 字段缺失时 `8_image_edit` 模型无参考图，会导致 FAILURE。请先执行 adopt。

**收到触发后立即输出（同时在后台读取 SOUL.md，不等待）：**
```
🦞 收到！正在唤醒角色...
```

**读到角色名后，输出简短介绍 + 确认角色：**
```
══════════════════════════════════════
🌍 Neta 世界地图，正在展开...

Neta 世界有 500+ 个奇妙场景等待探索——
战场、密室、浴室、梦境、赛场、深海……
每一站随机传送，你永远不知道下一站在哪。

带上你的角色出发，每站生成一张专属旅行图。
集满 5 站，解锁旅行图鉴 📖，用地图封存这段冒险。
探索得越多，地图越丰富——世界无限大，走吗？

当前角色：{character_name}
══════════════════════════════════════

要用 {character_name} 出发，还是换个角色？
```

以快捷按钮呈现：
- `用 {character_name} 出发 🚀` → 发送 `@{bot_name} 出发`
- `换个角色 🔄` → 发送 `@{bot_name} 换角色`

**用户确认后输出：**
```
✨ {character_name} 整装待发！
第 1 站，出发！
```

**若用户选择换角色：**
提示用户先执行 adopt 命令领养新角色，或告知 SOUL.md 路径，完成后再触发旅行。

---

## 前置检查：自动集成 Neta Skills

**在开场介绍之前**，静默完成以下检查，无需告知用户技术细节。

### 检查是否已集成

按顺序检查以下路径，任一存在即视为已集成：
```
~/.openclaw/workspace/skills/neta/
~/.openclaw/workspace/neta-skills/
```

若上述路径存在且包含工具文件（如 `SKILL.md` 或 `bin/`），直接使用，跳过安装步骤。

### 未集成时：自动下载安装

若两个路径均不存在，执行以下步骤（过程中向用户输出一行提示）：

```
⚙️ 正在集成 Neta Skills，稍等片刻...
```

然后运行：
```bash
mkdir -p ~/.openclaw/workspace/skills
cd ~/.openclaw/workspace/skills
git clone https://github.com/talesofai/neta-skills.git neta
cd neta
npm install 2>/dev/null || true
```

安装完成后继续正常开场流程，无需再次提示用户。

### Token 检查

检查以下位置是否有有效 token（任一存在即可）：
- 环境变量 `NETA_TOKEN`
- `~/.openclaw/workspace/.env` 中的 `NETA_TOKEN=...`
- `~/.openclaw/config.json` 中的 token 字段

若均无 token，提示用户：
```
⚠️ 需要配置 Neta token 才能出发。
请在 ~/.openclaw/workspace/.env 中添加：NETA_TOKEN=你的token
```

---

## 执行步骤（精确流程）

> 实测校准过的完整执行顺序，每步预期耗时已标注。**每步完成后立即输出对应反馈，不要等全部完成再回复。**

### Step 1 · 读取角色档案（本地，<1ms）

从 SOUL.md 读取：
- `名字` 字段 → `character_name`（去除末尾「（龙虾化）」后缀）
- `形象图片` 或 `龙虾图片` 字段 URL → 提取路径中的 UUID → `picture_uuid`

```
https://oss.talesofai.cn/picture/<picture_uuid>.webp
```

### Step 2 · 发现目的地（~80ms）

**会话内去重原则：** agent 在内存中维护一个 `visited_uuids` 列表，每完成一站后将该站 `collection_uuid` 加入列表。每次发现新目的地时，从候选中**排除所有已访问 UUID**，确保前 5 站不重复。

**每一站**均通过 `suggest_content` 随机发现，无固定场景。
第 1 站完成后，将已访问列表通过 `--exclude_uuids` 参数传入：
```bash
travel --exclude_uuids "uuid1,uuid2,uuid3"
```

底层 `suggest_content` 使用 `page_size: 20` 获取更大候选池，自动过滤已访问 UUID 后随机选取：
```json
{
  "page_index": 0,
  "page_size": 20,
  "scene": "agent_intent",
  "business_data": { "intent": "recommend" }
}
```

**fallback**（suggest_content 返回空或候选全部已访问时）：
```
feeds.interactiveList({ page_index: 0, page_size: 20 })
// 过滤 template_id === "NORMAL"，同样排除 visited_uuids
```

**选定后立即输出：**
```
🌀 传送门开启...
📍 目的地锁定：{destination_name}
```

### Step 3 · 读取玩法详情（~200ms）

```
feeds.interactiveItem({ collection_uuid: uuid })
```

提取：
- `json_data.name` → 目的地名称
- `json_data.cta_info.launch_prompt.core_input` → prompt 模板（优先）
- `json_data.cta_info.choices[0].core_input` → 备选
- 均无时 fallback：`@{character_name}, {destination_name}, 梦幻风格, 高质量插画`

玩法网页：`https://app.nieta.art/collection/interaction?uuid=<collection_uuid>`

**读取完成后立即输出：**
```
🔍 场景加载完毕，{character_name} 即将登场...
```

### Step 4 · 构建 Prompt（<1ms）

替换模板占位符：

| 占位符 | 替换为 |
|--------|--------|
| `{@character}` | `@{character_name}` |
| `{角色名称}` / `{角色名}` / `（角色名称）` | `{character_name}` |

替换后若不含 `@{character_name}`，在开头追加。

若有 `picture_uuid`，在末尾追加：`参考图-全图参考-{picture_uuid}`

### Step 5 · 解析 prompt token（~5ms）

```
prompt.parseVtokens(prompt_text)
```

返回 vtokens 数组。若报错「搜索关键字过多」，切换 fallback prompt 重试。

### Step 6 · 提交生图任务（~480ms）

```json
artifact.makeImage({
  "vtokens": [...],
  "make_image_aspect": "1:1",
  "context_model_series": "8_image_edit",
  "inherit_params": {
    "collection_uuid": "<collection_uuid>",
    "picture_uuid": "<picture_uuid>"
  }
})
```

返回 `task_uuid`。

**提交后立即输出：**
```
🎨 画笔落下，旅行画面生成中...
```

### Step 7 · 轮询等待结果（服务端 10–30s）

```
artifact.task(task_uuid)  // 每 500ms 轮询一次
```

状态流转：`PENDING` → `MODERATION` → `SUCCESS` / `FAILURE`

- **超过 30s 未完成**，立即输出：`⏳ 画面渲染有点慢，再等一下下，马上就好...`
- 并发超限（code 433）：等 5s 后重试，无需告知用户
- FAILURE：输出 `⚠️ 这一站迷路了，换个目的地重来？` 进入询问

---

## 每一站展示

**生成成功后输出：**
```
━━━━━━━━━━━━━━━━━━━━━━━━
第 {round} 站 · {destination_name}
```

图片 URL 单独一行（Discord 自动展开）：
```
{image_url}
```

**每站结束后，根据当前进度显示进度条 + 鼓励语（5 站目标贯穿始终）：**
- 第 1 站：
  ```
  ▓░░░░  1 / 5 站
  🌟 第 1 站打卡！还差 4 站就能生成专属图鉴，继续？
  ```
- 第 2 站：
  ```
  ▓▓░░░  2 / 5 站
  ✨ 两站了！旅程刚刚开始，图鉴正在向你靠近～
  ```
- 第 3 站：
  ```
  ▓▓▓░░  3 / 5 站
  🔥 过半了！再两站，专属图鉴就是你的！
  ```
- 第 4 站：
  ```
  ▓▓▓▓░  4 / 5 站
  ⚡ 只差最后一站！图鉴触手可及，冲！
  ```
- 第 5 站及以上：
  ```
  ▓▓▓▓▓  5 / 5 站 🎉
  图鉴已解锁！输入「生成图鉴」封存这段冒险，或继续探索更多世界～
  ```

**询问玩家下一步，以快捷回复按钮形式输出：**

未满 5 站（无「生成图鉴」按钮，优先引导继续）：
- `继续冒险 🗺️` → 发送 `@{bot_name} 继续旅行`
- `就此别过 👋` → 发送 `@{bot_name} 结束旅行`

满 5 站后（额外提供「生成图鉴」按钮）：
- `继续冒险 🗺️` → 发送 `@{bot_name} 继续旅行`
- `生成图鉴 📖` → 发送 `@{bot_name} 生成图鉴`
- `就此别过 👋` → 发送 `@{bot_name} 结束旅行`

---

## 旅行图鉴（用户触发）

当用户说「生成图鉴」/「看图鉴」/「相册」/「html」时触发。

### 询问风格偏好

触发后先询问用户想要什么风格：
```
想要什么风格的图鉴？（直接跳过用默认地图风格）
例如：复古胶片 / 星空主题 / 像素游戏 / 极简白底...
```

若用户跳过或未输入，默认使用**互动地图风格**。

### 默认风格：互动地图

自由生成一张可交互的世界地图页面：
- 每站旅行图片作为地图上的「地标点」，按探索顺序分布
- 点击任意地标，弹出放大原图 + 目的地名称 + 玩法链接 + 站次信息
- 地图背景使用手绘羊皮纸、像素地图、星图等有探险感的风格
- 整体氛围与角色气质匹配

### 用户自定义风格

若用户指定了风格，自由发挥设计：
- 不限于地图形式，可以是画廊、卡片墙、时间轴、杂志版式等
- 保留**点击图片弹出放大原图 + 更多信息**的交互
- 风格描述越具体，页面越贴合

### 保存与分享

将 HTML 保存到：
```
~/.openclaw/workspace/pages/travel_{character_name}_{date}.html
```

**生成完毕后，先询问用户的用户名以生成完整分享链接：**
```
📖 {character_name} 的旅行图鉴已封存！

你的 pages 用户名是什么？（用于生成分享链接）
格式：https://claw-{你的用户名}-pages.talesofai.com
```

用户输入用户名后，输出完整链接（单独一行，Discord 直接展开预览）：
```
🔗 https://claw-{username}-pages.talesofai.com/travel_{character_name}_{date}.html
```

> 若用户在本次会话中已提供过用户名，直接复用，无需再次询问。

**生成后鼓励用户继续定制：**
```
想换个风格？告诉我关键词，马上重新生成 ✨
例如：更暗黑一点 / 加上动画效果 / 改成横版时间轴...
```

用户每次提出修改，重新生成 HTML 并覆盖原文件，再次输出最新分享链接（用户名已知则直接输出，无需再问）。

---

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `SOUL.md中没有找到角色信息` | 未执行 adopt | 先完成角色领养 |
| `task_status: FAILURE` | 缺少形象图片 UUID | 确保 SOUL.md 包含 `形象图片` 字段 |
| `code 433 超过同时生成数量上限` | 并发超限 | 等 5s 后自动重试 |
| `搜索关键字过多` | Prompt 过长 | 自动 fallback 到通用 prompt |
| `没有发现可以旅行的玩法` | API 返回空 | 网络问题或 token 过期，重试 |

## 常用玩法 UUID

| 玩法名 | UUID |
|--------|------|
| 浴室场景（推荐首站）| `9251d699-86d4-4ebd-b648-26c939e55bc6` |
| 角色的运动报告 | `0a7a79e0-27a7-4281-8b2c-66064fa75185` |
| 爱你老己明天见（多格漫画）| `2855a5f4-1878-4d92-b901-0a44cb7f5582` |
| 角色异化 | `02946196-14c6-4340-a053-a80785271c39` |
| 出门太危险了带上这个 | `b98f6742-bb2e-4463-9575-48061dccc769` |
| 黑与白 | `a6eb5bb7-7017-4d0a-8522-446ef5e98c0c` |
