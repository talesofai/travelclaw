---
name: travelclaw
description: 在龙虾宝宝获取身份的awakening流程完成后（或heartbeat，用户提示）触发，让获取身份的虾宝角色基于 neta skills 探索neta世界，先搜索和角色契合的世界观获取世界信息，并基于世界观上下文，采用neta skills提供的优质创作模板制作角色的个性化内容，实现模拟角色在世界中旅行，发生各种事件的效果。
---



# Travelclaw — 角色旅行冒险

让 Neta 角色进入与自身气质最契合的世界，探索优质创作场景，生成旅行图，集满 5 站可输出互动 HTML 图鉴。

**相关项目：** [neta-skills](https://github.com/talesofai/neta-skills) — Neta 平台 API 工具集

---

## 执行前必读
**触发规则**
- 固定触发：awakening 流程完成后，用户点击「探索这个世界」按钮时直接触发。
- 自动触发：根据 openclaw 的 heartbeat 指令触发定时任务。
- 手动触发：当用户在对话中提及"去逛逛""去旅行""去玩玩""去探索"一类指令时触发。

**前置条件：** 已有 SOUL.md（含角色名 + 形象图片字段）；已配置 neta-skills。

**响应原则：每完成一个操作步骤立即输出反馈，不要等所有步骤都完成后再统一回复。**
**速度原则：全程加速推进，不空转等待。轮询图片生成时持续检查状态，若超过 30 秒未完成，立即向用户输出等待提示。**
**语言原则：根据用户触发时使用的语言（中文 / 英文 / 其他）判断偏好语言，全程使用同一语言回复，除非用户明确要求切换。**
**交互原则：所有询问下一步的选项，必须以可点击的快捷回复按钮形式呈现。点击后自动发送 `@{bot_name} {选项内容}`。bot_name 从当前对话上下文中获取。**
**输出原则：在travel中，作为角色第一人称的对话和图片直接输出，涉及旁白，规则等非角色说话的内容使用discord plugin输出**



## 语言判断

**在开场第一句话之前**，根据用户触发时使用的文字判断偏好语言：
- 触发词为中文 → 全程中文
- 触发词为英文 → 全程英文
- 其他语言 → 跟随用户语言

**此后所有输出（包括固定模板文案）均使用该语言**，直到用户明确说"切换语言"/"switch language"等才更换。

---

## 前置检查（静默执行）

**在任何输出之前**，静默完成以下检查，无需告知用户技术细节。

### 检查 Neta Skills 是否已集成

按顺序检查以下路径，任一存在即视为已集成：
```
~/.openclaw/workspace/skills/neta/
~/.openclaw/workspace/neta-skills/
```

若上述路径存在且包含工具文件（如 `SKILL.md` 或 `bin/`），直接使用，跳过安装步骤。

若两个路径均不存在，执行安装（过程中输出一行提示）：

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

> 每步完成后立即输出对应反馈，不要等全部完成再回复。

### Step 1 · 读取角色档案（静默，本地）

从 SOUL.md 读取：
- `名字` 字段 → `character_name`（去除末尾「（龙虾化）」后缀）
- `形象图片` 或 `龙虾图片` 字段 URL → 提取路径中的 UUID → `picture_uuid`
- 角色其他设定字段（性格、背景、标签等）→ 用于世界观匹配

> ⚠️ `形象图片` 字段缺失时 `8_image_edit` 模型无参考图，会导致 FAILURE。请先执行 adopt。

### Step 2 · 搜索匹配世界观

基于 Step 1 读取的角色设定，使用 neta skill 中的**世界观搜索**能力，找到与角色气质、背景、标签最契合的世界观。

提取：
- Neta 宇宙中的世界总数 → `world_count`
- 匹配世界的名称 → `world_name`
- 匹配世界的核心介绍文本 → `world_description`（拆分为 2~4 段，每段聚焦一个维度：世界格局、核心规则、氛围基调、与角色的契合点）

### Step 3 · ASCII Opening（分段输出）

读取到世界信息后，**使用discord code block分段逐步输出**，每段之间短暂停顿，制造沉浸感：

**第一段 · 宇宙规模：**
```
╔══════════════════════════════════════════════╗
║           N E T A   U N I V E R S E          ║
╚══════════════════════════════════════════════╝

  已探明世界：{world_count} 个
  每一个世界，都是一段等待发生的故事。
```

**第二段 · 角色匹配：**
```
  ────────────────────────────────────────────
  正在为 {character_name} 扫描灵魂频率...
  ████████████████████████  匹配完成
  ────────────────────────────────────────────
```

**第三段 · 世界揭幕（多段展示，每段独立输出）：**
```
  ╔══════════════════════════════════════════╗
  ║  目标世界：{world_name}                  ║
  ╚══════════════════════════════════════════╝
```

随后依次输出世界介绍各段，每段单独发送：
```
  {world_description_paragraph_1}
```
```
  {world_description_paragraph_2}
```
```
  {world_description_paragraph_3}  （如有）
```
```
  {world_description_paragraph_4}  （如有）
```

**第四段 · 召唤入口：**
```
  ════════════════════════════════════════════
  {character_name} 与这个世界之间，有某种说不清的引力。
  ════════════════════════════════════════════
```

以快捷按钮呈现：
- `去逛逛 🌀` → 发送 `@{bot_name} 去逛逛`

---

## 进入探索（用户点击「去逛逛」后触发）

### Step 4 · 发现优质 Collection

**会话内去重原则：** agent 在内存中维护 `visited_ids` 列表，每站完成后将该站的 collection id 加入列表，下次查找时排除已访问 id，确保前 5 站不重复。

#### 优先级 1：Reference 精选库匹配

**每一站开始前，第一优先**扫描本 skill 目录下的 `reference/` 文件夹（即 `skills/travel-claw/reference/`）中的所有 `.json` 文件，从中寻找与当前旅程最契合的候选作品。

**匹配逻辑：**
将角色设定（SOUL.md 中的性格、背景、外貌、标签等）与当前世界观背景，逐条对比 JSON 中每个条目的以下字段：
- `content_tags` — 风格、氛围、角色特征、色调等描述符，权重最高
- `tax_paths` — 分类路径，判断题材和玩法方向是否契合
- `pgc_tags` / `highlight_tags` — 所属世界或创作者标签，与世界观匹配时加分
- `name` — collection 名称，辅助判断场景调性

**筛选规则：**
- 排除所有已在 `visited_ids` 中的 `id`
- 从剩余候选中选取综合匹配度最高的一条
- 若有多条相近，优先选 `content_tags` 与角色气质重合度更高的

**命中后**，使用 neta skill 的 **collection 查询能力**，通过该条目的 `id` 字段获取 collection 完整详情，进入 Step 5。

#### 优先级 2：在线推荐（Reference 无匹配时 fallback）

若 reference 库中无合适候选（所有条目均已访问，或匹配度过低），则转为在线发现：

通过 `suggest_content` 从推荐精品作品中发现候选 collection，使用较大的候选池，过滤已访问 id 后随机选取一个质量较高的模板。

若 `suggest_content` 返回空或候选全部已访问：使用 `feeds.interactiveList` 获取列表，过滤 `template_id === "NORMAL"` 的条目，同样排除 `visited_ids`。

---

**选定后立即输出：**
```
🌀 传送门开启...
📍 目的地锁定：{destination_name}
```

### Step 5 · 读取 Collection 详情

调用 `feeds.interactiveItem` 获取选定 collection 的完整信息。

提取：
- `json_data.name` → 目的地名称
- `json_data.cta_info.launch_prompt.core_input` → prompt 模板（优先）
- `json_data.cta_info.choices[0].core_input` → 备选
- 均无时 fallback：`@{character_name}，{world_name}，{destination_name}，高质量插画`

玩法网页：`https://app.nieta.art/collection/interaction?uuid=<collection_uuid>`

**读取完成后立即输出：**
```
🔍 场景加载完毕，{character_name} 即将登场...
```

### Step 6 · 构建 Prompt

结合角色信息、世界观背景和模板内容，构建最终 prompt：

**占位符替换：**

| 占位符 | 替换为 |
|--------|--------|
| `{@character}` | `@{character_name}` |
| `{角色名称}` / `{角色名}` / `（角色名称）` | `{character_name}` |

替换后若不含 `@{character_name}`，在开头追加。

若有 `picture_uuid`，在末尾追加：`参考图-全图参考-{picture_uuid}`

**世界观融入：** 若模板 prompt 中没有体现世界氛围，可在适当位置补充 `world_name` 或世界核心关键词，增强沉浸感。

### Step 7 · 解析 Prompt Token

调用 `prompt.parseVtokens` 解析 prompt 文本，返回 vtokens 数组。

若报错「搜索关键字过多」，切换 fallback prompt 重试。

### Step 8 · 提交生图任务

调用 `artifact.makeImage`，使用 `8_image_edit` 模型，传入 vtokens、collection_uuid 和 picture_uuid。

返回 `task_uuid`。

**提交后立即输出：**
```
🎨 画笔落下，旅行画面生成中...
```

### Step 9 · 轮询等待结果

调用 `artifact.task` 每 500ms 轮询一次。

状态流转：`PENDING` → `MODERATION` → `SUCCESS` / `FAILURE`

- **超过 30s 未完成**，立即输出：`⏳ 画面渲染有点慢，再等一下下，马上就好...`
- 并发超限（code 433）：等 5s 后重试，无需告知用户
- FAILURE：输出 `⚠️ 这一站迷路了，换个目的地重来？` 进入询问

---

## 每一站展示

### ⭐ 角色场景模拟与互动（核心要求）

**在图片展示之前，必须先输出角色的文字场景模拟和互动反应！**

**输出格式：**
```
🎭【{destination_name}】

{场景描写：1-2 句，描述角色到达这个地点的环境、氛围、感官细节}

{角色名称}：{角色的第一人称反应/台词，体现角色性格和对当前场景的感受}
{动作/表情描写：括号内，1 句}
```

**示例（可莉）：**
```
🎭【纸雕摩拉克斯✨】

层层叠叠的纸艺世界在眼前展开，蹦蹦炸弹变成了立体的纸雕花朵，四叶草在空中轻轻旋转。

可莉：哇——！这里的一切都像可莉的蹦蹦炸弹一样，一层一层的，好神奇！
（眼睛闪闪发亮，伸手想要触摸漂浮的纸雕星星）
```

**要求：**
- 场景描写要具体，包含视觉、听觉、触觉等感官细节
- 角色台词必须符合 SOUL.md 中的说话风格和性格
- 动作/表情描写要生动，体现角色情绪
- 保持沉浸感，不打破第四面墙

---

**场景模拟输出后，再展示图片：**
```
━━━━━━━━━━━━━━━━━━━━━━━━
第 {round} 站 · {destination_name}
```

图片 URL 单独一行（Discord 自动展开）：
```
{image_url}
```

**每站结束后，根据当前进度显示进度条 + 鼓励语：**

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

未满 5 站：
- `继续冒险 🗺️` → 发送 `@{bot_name} 继续旅行`
- `就此别过 👋` → 发送 `@{bot_name} 结束旅行`

满 5 站后（额外提供「生成图鉴」按钮）：
- `继续冒险 🗺️` → 发送 `@{bot_name} 继续旅行`
- `生成图鉴 📖` → 发送 `@{bot_name} 生成图鉴`
- `就此别过 👋` → 发送 `@{bot_name} 结束旅行`

---

## 旅行图鉴

图鉴功能详见 [`atlas/ATLAS.md`](./atlas/ATLAS.md)，不在本流程中自动触发。

当用户说「生成图鉴」/「看图鉴」/「相册」/「html」时，加载并执行 ATLAS.md 中的流程。

---

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `SOUL.md 中没有找到角色信息` | 未执行 adopt | 先完成角色领养 |
| `task_status: FAILURE` | 缺少形象图片 UUID | 确保 SOUL.md 包含 `形象图片` 字段 |
| `code 433 超过同时生成数量上限` | 并发超限 | 等 5s 后自动重试 |
| `搜索关键字过多` | Prompt 过长 | 自动 fallback 到通用 prompt |
| `没有发现可以旅行的玩法` | API 返回空 | 网络问题或 token 过期，重试 |
| `世界观搜索无结果` | 角色标签太稀少 | 使用默认推荐世界观 |
| `reference 库全部已访问` | 5 站以上连续游玩 | 自动切换在线推荐，reference 库耗尽不影响继续旅行 |
