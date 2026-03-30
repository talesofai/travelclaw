#!/usr/bin/env node
/**
 * neta-gen.js — 混合模式角色图片生成器
 *
 * 支持两种模式：
 * 1. 自由生成：直接传入完整场景描述
 * 2. Collection模板：传入collection_uuid + 注入内容，替换模板中的{world_context}占位符
 *
 * Usage:
 *   # 自由生成
 *   node neta-gen.js "在海边看日落"
 *
 *   # 使用Collection模板（注入世界观/风格）
 *   node neta-gen.js "赛博朋克风格，霓虹灯光，高科技城市" "collection_uuid"
 *
 *   # 带参考图
 *   node neta-gen.js "描述内容" "collection_uuid" "pic_uuid"
 *
 * Note: Character is read from SOUL.md
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

// ── Config ──────────────────────────────────────────────────────────────────

const BASE = 'https://api.talesofai.cn';

function getToken() {
  if (process.env.NETA_TOKEN) return process.env.NETA_TOKEN;
  const envFiles = [
    resolve(homedir(), '.openclaw/workspace/.env'),
    resolve(homedir(), 'developer/clawhouse/.env'),
  ];
  for (const p of envFiles) {
    try {
      const m = readFileSync(p, 'utf8').match(/NETA_TOKEN=(.+)/);
      if (m) return m[1].trim();
    } catch { /* not found, try next */ }
  }
  throw new Error('NETA_TOKEN not found. Add it to ~/.openclaw/workspace/.env');
}

const HEADERS = {
  'x-token': getToken(),
  'x-platform': 'nieta-app/web',
  'content-type': 'application/json',
};

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: HEADERS,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

const log = msg => process.stderr.write(msg + '\n');
const out = data => console.log(JSON.stringify(data));

// ── Main: Generate image with character ─────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // 参数解析：支持灵活顺序
  let injectContent = '';
  let collectionUuid = null;
  let picUuid = null;

  for (const arg of args) {
    // 检测 UUID 格式（包含横杠）
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg)) {
      if (!collectionUuid) {
        collectionUuid = arg;
      } else if (!picUuid) {
        picUuid = arg;
      }
    } else {
      // 非 UUID 视为注入内容
      injectContent = arg;
    }
  }

  if (!injectContent) {
    process.stderr.write('Usage: node neta-gen.js "<content>" [collection_uuid] [pic_uuid]\n');
    process.stderr.write('\nExamples:\n');
    process.stderr.write('  # 自由生成\n');
    process.stderr.write('  node neta-gen.js "在海边看日落"\n\n');
    process.stderr.write('  # 使用Collection模板\n');
    process.stderr.write('  node neta-gen.js "赛博朋克风格" "collection_uuid"\n\n');
    process.stderr.write('  # 带参考图\n');
    process.stderr.write('  node neta-gen.js "描述" "collection_uuid" "pic_uuid"\n');
    process.exit(1);
  }

  // 1. Read character from SOUL.md
  const soulPaths = [
    resolve(homedir(), '.openclaw/workspace/SOUL.md'),
    resolve(homedir(), 'developer/clawhouse/SOUL.md'),
  ];

  let soulContent;
  for (const p of soulPaths) {
    try { soulContent = readFileSync(p, 'utf8'); break; } catch { }
  }

  if (!soulContent) {
    throw new Error('SOUL.md not found. Create one first.');
  }

  // Extract character name from SOUL.md
  const charName = soulContent
    .match(/(?:名字|角色名)[^：:\n]*[：:]\s*([^\n*]+)/)?.[1]
    ?.trim()
    ?.replace(/\*+/g, '')
    ?.replace(/[（(][^）)]*[）)]$/, '')
    ?.trim();

  if (!charName) {
    throw new Error('No 名字 or 角色名 field found in SOUL.md');
  }

  // 2. Find character TCP UUID
  const charQuery = charName.replace(/\s*[（(][^）)]*[）)]/g, '').trim();
  const search = await api('GET',
    `/v2/travel/parent-search?keywords=${encodeURIComponent(charQuery)}&parent_type=oc&sort_scheme=exact&page_index=0&page_size=1`);
  const char = search.list?.find(r => r.type === 'oc');
  log(`🔎 Character: ${char ? `${char.name} (${char.uuid})` : 'Not found, using freetext'}`);

  // 3. Build prompt
  let promptText = '';
  let sceneName = '自由生成';

  if (collectionUuid) {
    // 模式A：使用 Collection 模板
    log(`📦 Loading collection: ${collectionUuid}`);
    const feedData = await api('GET',
      `/v1/home/feed/interactive?collection_uuid=${collectionUuid}&page_index=0&page_size=1`);
    const item = feedData.module_list?.[0];

    if (item) {
      sceneName = item.json_data.name;
      const cta = item.json_data?.cta_info ?? {};

      // 获取模板
      let promptTemplate = cta.launch_prompt?.core_input
        ?? cta.choices?.[0]?.core_input
        ?? null;

      // 从 verse preset 获取
      if (!promptTemplate && cta.interactive_config?.verse_uuid) {
        const verse = await api('GET', `/v1/verse/preset/${cta.interactive_config.verse_uuid}`)
          .catch(() => null);
        promptTemplate = verse?.launch_prompt?.core_input ?? null;
      }

      if (promptTemplate) {
        // 1. 先替换角色名占位符
        let processedTemplate = promptTemplate
          .replace(/\{@character\}/g, charName)
          .replace(/\{角色名称\}|\{角色名\}|（角色名称）/g, charName);
        
        // 2. 【核心】将注入内容强制插入到模板最前面
        promptText = `${injectContent}。${processedTemplate}`;

        log(`📝 Template loaded: ${sceneName}`);
        log(`📝 Inject content prepended: ${injectContent.substring(0, 50)}...`);
      } else {
        // 模板不存在，回退到注入内容
        promptText = `@${charName}, ${injectContent}`;
      }
    } else {
      // Collection 不存在，回退
      promptText = `@${charName}, ${injectContent}`;
    }
  } else {
    // 模式B：自由生成
    promptText = `@${charName}, ${injectContent}`;
  }

  // 清理 @角色名（如果有 TCP）和参考图标记
  if (char) {
    promptText = promptText.replace(new RegExp(`@${charName}[,，\\s]*`, 'g'), '').trim();
  }
  promptText = promptText.replace(/参考图-\S+/g, '').replace(/图片捏-\S+/g, '').trim();

  // 4. Build vtokens
  const vtokens = [];
  if (char) {
    vtokens.push({
      type: 'oc_vtoken_adaptor',
      uuid: char.uuid,
      name: char.name,
      value: char.uuid,
      weight: 1,
    });
  }

  if (promptText) {
    vtokens.push({ type: 'freetext', value: promptText, weight: 1 });
  }

  log(`📝 Final prompt: ${promptText.substring(0, 100)}...`);
  log(`🎨 Generating: ${charName} — ${sceneName}`);

  // 5. Submit image generation
  const taskUuid = await api('POST', '/v3/make_image', {
    storyId: 'DO_NOT_USE',
    jobType: 'universal',
    rawPrompt: vtokens,
    width: 896,
    height: 1152,
    meta: { entrance: 'PICTURE' },
    context_model_series: '8_image_edit',
    inherit_params: {
      ...(collectionUuid ? { collection_uuid: collectionUuid } : {}),
      ...(picUuid ? { picture_uuid: picUuid } : {}),
    },
  });

  const task_uuid = typeof taskUuid === 'string' ? taskUuid : taskUuid?.task_uuid;
  log(`⏳ task: ${task_uuid}`);

  // 6. Poll every 500ms (max 3 min)
  let warnedSlow = false;
  for (let i = 0; i < 360; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (!warnedSlow && i >= 60) {
      log('⏳ Taking longer, almost there...');
      warnedSlow = true;
    }
    const result = await api('GET', `/v1/artifact/task/${task_uuid}`);
    if (result.task_status !== 'PENDING' && result.task_status !== 'MODERATION') {
      if (result.task_status !== 'SUCCESS') {
        log(`⚠️  Failed: ${result.task_status}`);
      }
      out({
        char_name: char?.name || charName,
        scene: sceneName,
        task_uuid,
        status: result.task_status,
        url: result.artifacts?.[0]?.url ?? null,
        collection_uuid: collectionUuid,
      });
      process.exit(0);
    }
  }

  out({ char_name: charName, scene: sceneName, task_uuid, status: 'TIMEOUT', url: null, collection_uuid: collectionUuid });
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
