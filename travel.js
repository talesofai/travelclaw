#!/usr/bin/env node
/**
 * travel.js — Travelclaw API helper (zero neta-skills dependency)
 *
 * Commands:
 *   node travel.js soul [soul_path]                   → {name, picture_uuid}
 *   node travel.js suggest [exclude_csv]              → {uuid, name, from_ref}
 *   node travel.js gen <char_name> <pic_uuid> <uuid>  → {scene, status, url, collection_uuid}
 *
 * suggest priority: scenes.json (local, tag-scored) → online API fallback
 * API: https://api.talesofai.com (override via NETA_API_BASE_URL env)
 * Token resolved from: NETA_TOKEN env → ~/.openclaw/workspace/.env → clawhouse .env
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

// ── Config ──────────────────────────────────────────────────────────────────

const BASE = process.env.NETA_API_BASE_URL ?? process.env.NETA_API_URL ?? 'https://api.talesofai.com';

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
const [,, cmd, ...args] = process.argv;

// ── soul: read character from SOUL.md ───────────────────────────────────────

if (cmd === 'soul') {
  const candidates = [
    args[0],
    resolve(homedir(), '.openclaw/workspace/SOUL.md'),
    resolve(homedir(), 'developer/clawhouse/SOUL.md'),
  ].filter(Boolean);

  let content;
  for (const p of candidates) {
    try { content = readFileSync(p, 'utf8'); break; } catch { /* try next */ }
  }
  if (!content) throw new Error('SOUL.md not found. Run adopt first.');

  // Accept both 名字 and 角色名 field names
  const name = content
    .match(/(?:名字|角色名)[^：:\n]*[：:]\s*([^\n*]+)/)?.[1]
    ?.trim()
    ?.replace(/\*+/g, '')
    ?.replace(/[（(][^）)]*[）)]$/, '')  // strip any trailing parenthetical e.g. (小吉祥草王) or （龙虾化）
    ?.trim();

  const picUuid = content
    .match(/\/picture\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)?.[1];

  if (!name) throw new Error('No 名字 or 角色名 field found in SOUL.md. Run adopt first.');
  out({ name, picture_uuid: picUuid ?? null });
}

// ── suggest: pick a destination (local scenes.json first, API fallback) ─────

else if (cmd === 'suggest') {
  const exclude = (args[0] ?? '').split(',').filter(Boolean);

  // ── Priority 1: local scenes.json with tag-based scoring ──────────────────
  const scenesPaths = [
    resolve(homedir(), '.openclaw/workspace/skills/neta-travel/scenes.json'),
    resolve(homedir(), 'developer/neta-travel/scenes.json'),
    resolve(homedir(), 'developer/travelclaw/scenes.json'),
    new URL('./scenes.json', import.meta.url).pathname,
  ];

  let refPick = null;
  for (const p of scenesPaths) {
    try {
      const scenes = JSON.parse(readFileSync(p, 'utf8'));
      const available = scenes.filter(s => s.collection_uuid && !exclude.includes(s.collection_uuid));
      if (!available.length) break;

      // Score against SOUL.md tags if available
      const soulText = (() => {
        const soulPaths = [
          resolve(homedir(), '.openclaw/workspace/SOUL.md'),
          resolve(homedir(), 'developer/clawhouse/SOUL.md'),
        ];
        for (const sp of soulPaths) {
          try { return readFileSync(sp, 'utf8'); } catch { /* try next */ }
        }
        return '';
      })();

      const soulWords = new Set(
        soulText.split(/[，、。\s,\n：:*【】（）()]+/).filter(w => w.length >= 2)
      );

      const scored = available.map(s => {
        let score = 0;
        for (const tag of s.content_tags ?? []) {
          for (const w of soulWords) { if (tag.includes(w) || w.includes(tag)) score += 2; }
        }
        for (const path of s.tax_paths ?? []) {
          for (const w of soulWords) { if (path.includes(w)) score += 1; }
        }
        return { s, score };
      });

      // Pick best-scoring; break ties randomly
      scored.sort((a, b) => b.score - a.score);
      const topScore = scored[0].score;
      const top = scored.filter(x => x.score === topScore);
      refPick = top[Math.floor(Math.random() * top.length)].s;
      break;
    } catch { /* file not found, try next */ }
  }

  if (refPick) {
    out({ uuid: refPick.collection_uuid, name: refPick.name, from_ref: true });
    process.exit(0);
  }

  // ── Priority 2: online API ─────────────────────────────────────────────────
  const data = await api('POST', '/v1/recsys/content', {
    page_index: 0,
    page_size: 20,
    scene: 'agent_intent',
    business_data: {
      intent: 'recommend',
      search_keywords: [], tax_paths: [],
      tax_primaries: [], tax_secondaries: [], tax_tertiaries: [],
      exclude_keywords: [], exclude_tax_paths: [],
    },
  });

  let candidates = (data.module_list ?? [])
    .filter(m => m.template_id === 'NORMAL' && !exclude.includes(m.data_id));

  if (!candidates.length) {
    const fb = await api('GET', '/v1/recsys/feed/interactive?page_index=0&page_size=20');
    candidates = (fb.module_list ?? [])
      .filter(m => m.template_id === 'NORMAL' && !exclude.includes(m.data_id));
  }

  if (!candidates.length) throw new Error('No destinations found. Check token or network.');

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  out({ uuid: pick.data_id, name: pick.json_data?.name ?? pick.data_id, from_ref: false });
}

// ── gen: scene prompt + character lookup + image generation + poll ───────────

else if (cmd === 'gen') {
  const [charName, picUuid, collectionUuid] = args;
  if (!charName || !collectionUuid) {
    throw new Error('Usage: travel.js gen <char_name> <pic_uuid> <collection_uuid>');
  }

  // 1. Fetch scene info (1 API call — cta_info.launch_prompt.core_input is in the feed item)
  const feedData = await api('GET',
    `/v1/home/feed/interactive?collection_uuid=${collectionUuid}&page_index=0&page_size=1`);
  const item = feedData.module_list?.[0];
  if (!item) throw new Error(`Scene not found: ${collectionUuid}`);

  const sceneName = item.json_data.name;
  const cta = item.json_data?.cta_info ?? {};

  // Extract prompt template — launch_prompt is in cta_info directly for verse-type collections
  let promptTemplate = cta.launch_prompt?.core_input
    ?? cta.choices?.[0]?.core_input
    ?? null;

  // Rare fallback: fetch verse preset if prompt not in cta_info directly
  if (!promptTemplate && cta.interactive_config?.verse_uuid) {
    log('📖 Fetching verse preset...');
    const verse = await api('GET', `/v1/verse/preset/${cta.interactive_config.verse_uuid}`)
      .catch(() => null);
    promptTemplate = verse?.launch_prompt?.core_input ?? null;
  }

  // Ultimate fallback
  if (!promptTemplate) promptTemplate = `@${charName}, ${sceneName}, 高质量插画`;

  log(`🔍 Scene loaded: ${charName} entering the scene...`);

  // 2. Replace placeholders
  let promptText = promptTemplate
    .replace(/\{@character\}/g, charName)
    .replace(/\{角色名称\}|\{角色名\}|（角色名称）/g, charName);

  // 3. Find character TCP UUID (needed for oc_vtoken_adaptor)
  // Strip parentheticals from charName before TCP search (e.g. "纳西妲 (小吉祥草王)" → "纳西妲")
  const charQuery = charName.replace(/\s*[（(][^）)]*[）)]/g, '').trim();
  const search = await api('GET',
    `/v2/travel/parent-search?keywords=${encodeURIComponent(charQuery)}&parent_type=oc&sort_scheme=exact&page_index=0&page_size=1`);
  const char = search.list?.find(r => r.type === 'oc');
  log(`🔎 TCP search: "${charQuery}" → ${char ? `found ${char.name} (${char.uuid})` : 'not found, using freetext'}`);

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
    // Strip @charName from text — character already covered by vtoken above
    promptText = promptText.replace(new RegExp(`@${charName}[,，\\s]*`, 'g'), '').trim();
  }
  // Strip 参考图-* tokens — picture reference handled via inherit_params.picture_uuid instead
  promptText = promptText.replace(/参考图-\S+/g, '').replace(/图片捏-\S+/g, '').trim();

  if (promptText) vtokens.push({ type: 'freetext', value: promptText, weight: 1 });
  log(`📝 vtokens: ${JSON.stringify(vtokens)}`);

  // 5. Submit image generation
  log('🎨 Painting the scene...');
  const taskUuid = await api('POST', '/v3/make_image', {
    storyId: 'DO_NOT_USE',
    jobType: 'universal',
    rawPrompt: vtokens,
    width: 576,
    height: 768,  // 3:4 aspect
    meta: { entrance: 'PICTURE,VERSE' },
    context_model_series: '8_image_edit',
    inherit_params: {
      collection_uuid: collectionUuid,
      ...(picUuid ? { picture_uuid: picUuid } : {}),
    },
  });

  // /v3/make_image returns a plain string task UUID
  const task_uuid = typeof taskUuid === 'string' ? taskUuid : taskUuid?.task_uuid;
  log(`⏳ task: ${task_uuid}`);

  // 6. Poll every 500ms (max 3 min)
  let warnedSlow = false;
  for (let i = 0; i < 360; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (!warnedSlow && i >= 60) {
      log('⏳ Rendering is taking a bit longer, almost there...');
      warnedSlow = true;
    }
    const result = await api('GET', `/v1/artifact/task/${task_uuid}`);
    if (result.task_status !== 'PENDING' && result.task_status !== 'MODERATION') {
      if (result.task_status !== 'SUCCESS') {
        log(`⚠️  gen FAILURE — task_status: ${result.task_status}`);
        log(`   error_code: ${result.error_code ?? 'n/a'}  error_msg: ${result.error_msg ?? 'n/a'}`);
        log(`   artifacts: ${JSON.stringify(result.artifacts ?? [])}`);
      }
      out({
        scene: sceneName,
        task_uuid,
        status: result.task_status,
        url: result.artifacts?.[0]?.url ?? null,
        collection_uuid: collectionUuid,
      });
      process.exit(0);
    }
  }

  out({ scene: sceneName, task_uuid, status: 'TIMEOUT', url: null, collection_uuid: collectionUuid });
}

else {
  process.stderr.write(
    'Usage: node travel.js soul | suggest [exclude_csv] | gen <char_name> <pic_uuid> <collection_uuid>\n'
  );
  process.exit(1);
}
