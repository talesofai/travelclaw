# Discord 监听器 - 自动触发觉醒

这个监听器进程会让 Bot 在被添加到**私有文本频道**时自动发送觉醒引导消息。

---

## 🚀 快速启动

```bash
# 进入目录
cd /home/node/.openclaw/workspace/skills/travelclaw/skills/discord-awaken-claw/reference

# 启动监听器
./start-listener.sh start

# 查看状态
./start-listener.sh status

# 查看日志
./start-listener.sh logs

# 停止
./start-listener.sh stop

# 重启
./start-listener.sh restart
```

---

## 📋 功能说明

### 自动触发场景

| 场景 | 触发条件 | 行为 |
|------|---------|------|
| **创建私有频道** | 用户在服务器中创建私有文本频道，并邀请 Bot | Bot 自动发送觉醒引导消息 + 按钮 |
| **Bot 加入服务器** | Bot 被邀请到新的 Discord 服务器 | Bot 在系统频道或第一个可用频道发送引导消息 |

### 不触发的场景

| 场景 | 原因 |
|------|------|
| 公开频道 | 没有权限覆盖（permission_overwrites） |
| 语音频道 | 只监听文本频道（type 0 和 5） |
| 已见过的频道 | 防止重复触发（使用 `_seenChannels` 记录） |

---

## 🔧 配置

### 环境变量（`.env` 文件）

```bash
# Discord Bot Token（必需）
DISCORD_TOKEN=你的_bot_token

# 服务器 ID（可选，用于日志显示）
GUILD_ID=你的服务器 ID

# Neta API Token（可选，用于头像搜索）
# NETA_TOKEN=...
```

### 权限要求

Bot 需要以下权限：

- **查看频道** (View Channels)
- **发送消息** (Send Messages)
- **读取消息历史** (Read Message History)
- **嵌入链接** (Embed Links)
- **附加文件** (Attach Files)

---

## 📊 日志示例

### 成功启动
```
✅ 监听器已启动：龙虾宝宝#8879
   监听服务器：1480912787814350868

💡 现在当 Bot 被添加到私有文本频道时，会自动触发觉醒流程
```

### 频道创建触发
```
[频道创建] 1483241408717652208 test-channel
[发送成功] ○  龙虾宝宝 · 等待破壳中...
```

### 跳过公开频道
```
[跳过] 公开频道：1483241408717652209
```

---

## 🛠️ 故障排查

### 问题：进程启动失败

**检查日志：**
```bash
./start-listener.sh logs
```

**常见错误：**
- `❌ 缺少 DISCORD_TOKEN` → 检查 `.env` 文件是否存在且配置正确
- `Error: Cannot find module 'discord.js'` → 运行 `npm install`

### 问题：频道创建后没有触发

**可能原因：**
1. 频道是公开的（没有权限覆盖）
2. 频道类型不是文本频道（是语音或分类）
3. Bot 没有该频道的发送消息权限

**解决方法：**
- 确保频道是私有的（设置权限，只允许特定用户/角色访问）
- 确保 Bot 在频道中有发送消息权限

### 问题：重复触发

监听器使用 `_seenChannels` 记录已处理过的频道，防止重复触发。

如果测试时需要重新触发，可以：
1. 删除 `state.json` 文件
2. 或者删除并重新创建频道

---

## 📁 文件说明

| 文件 | 用途 |
|------|------|
| `channel-listener.js` | 监听器主程序 |
| `start-listener.sh` | 启动/停止/管理脚本 |
| `.env` | 环境变量配置 |
| `channel-listener.pid` | 进程 ID 文件（自动创建） |
| `channel-listener.log` | 日志文件（自动创建） |
| `direct-handler.js` | 觉醒逻辑处理器（被 listener 调用） |

---

## 🔁 与 OpenClaw 的关系

**监听器是独立的 Discord bot 进程**，不依赖 OpenClaw 运行。

```
┌─────────────────────┐         ┌─────────────────────┐
│  Discord Gateway    │         │   OpenClaw Agent    │
│  (实时事件推送)      │         │  (响应式消息处理)    │
└──────────┬──────────┘         └──────────┬──────────┘
           │                                │
           ▼                                │
┌─────────────────────┐                     │
│  channel-listener   │                     │
│  (独立 Node.js 进程)  │─────────────────────┘
│  监听事件 → 调用 handler  │    用户发消息时触发
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  direct-handler.js  │
│  (觉醒逻辑)          │
└─────────────────────┘
```

**协作方式：**
- **监听器**：处理 Discord 实时事件（频道创建、成员加入等）
- **OpenClaw**：处理用户主动发送的消息（@Bot 开始觉醒等）

两者可以**同时运行**，互不冲突。

---

## 🎯 测试方法

### 测试 1：创建私有频道

1. 在 Discord 服务器中创建一个新频道
2. 设置权限：只允许特定用户/角色访问（使频道变为私有）
3. 确保 Bot 在频道中有访问权限
4. 查看日志：应该看到 `[频道创建]` 和 `[发送成功]`

### 测试 2：邀请 Bot 到新服务器

1. 使用 Discord Developer Portal 生成 OAuth2 邀请链接
2. 将 Bot 邀请到新的测试服务器
3. 查看日志：应该看到 `[加入服务器]` 和 `[发送成功]`

---

## 📝 注意事项

1. **不要同时运行多个监听器实例** - 会导致重复发送消息
2. **定期检查日志** - 确保进程正常运行
3. **Token 安全** - 不要将 `.env` 文件提交到 Git
4. **进程管理** - 使用 `start-listener.sh` 脚本管理，不要直接用 `node` 启动

---

## 🆘 需要帮助？

查看完整日志：
```bash
tail -f /home/node/.openclaw/workspace/skills/travelclaw/skills/discord-awaken-claw/reference/channel-listener.log
```

检查进程状态：
```bash
ps aux | grep channel-listener
```

手动测试（前台运行）：
```bash
cd /home/node/.openclaw/workspace/skills/travelclaw/skills/discord-awaken-claw/reference
node channel-listener.js
```
