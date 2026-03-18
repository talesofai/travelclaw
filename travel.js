#!/usr/bin/env node
/**
 * travel.js — Travelclaw CLI (zero external dependencies)
 *
 * Commands:
 *   node travel.js soul   [soul_path]                    → {name, picture_uuid}
 *   node travel.js adopt  <char_name>                    → {name, picture_uuid}
 *   node travel.js suggest [exclude_csv]                 → {uuid, name, from_ref}
 *   node travel.js gen    <char_name> <pic_uuid> <uuid>  → {scene, status, url, collection_uuid}
 *
 * suggest priority: scenes.json (local, tag-scored) → live API fallback
 * API base: https://api.talesofai.cn
 * Token: NETA_TOKEN env → ~/.openclaw/workspace/.env → ~/developer/clawhouse/.env
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────────────────────

const BASE = 'https://api.talesofai.cn';

function getToken() {
  if (process.env.NETA_TOKEN) return process.env.NETA_TOKEN;
  for (const p of [
    resolve(homedir(), '.openclaw/workspace/.env'),
    resolve(homedir(), 'developer/clawhouse/.env'),
  ]) {
    try {
      const m = readFileSync(p, 'utf8').match(/NETA_TOKEN=(.+)/);
      if (m) return m[1].trim();
    } catch { /* try next */ }
  }
  throw new Error('NETA_TOKEN not found. Add it to ~/.openclaw/workspace/.env');
}

const HEADERS = () => ({
  'x-token': getToken(),
  'x-platform': 'nieta-app/web',
  'content-type': 'application/json',
});

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: HEADERS(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${path}: ${await res.text()}`);
  return res.json();
}

const log = msg => process.stderr.write(msg + '\n');
const out = data => console.log(JSON.stringify(data));
const [,, cmd, ...args] = process.argv;

// ── Helper: strip parentheticals ("纳西妲 (小吉祥草王)" → "纳西妲") ─────────────

function stripParens(s) {
  return s.replace(/\s*[（(][^）)]*[）)]/g, '').trim();
}

// ── Helper: poll task until terminal status ───────────────────────────────────

async function pollTask(task_uuid, { intervalMs = 500, maxTries = 360 } = {}) {
  let warnedSlow = false;
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    if (!warnedSlow && i >= 60) {
      log('⏳ Render is taking longer than usual, still waiting...');
      warnedSlow = true;
    }
    const result = await api('GET', `/v1/artifact/task/${task_uuid}`);
    if (result.task_status !== 'PENDING' && result.task_status !== 'MODERATION') return result;
  }
  return { task_status: 'TIMEOUT', artifacts: [] };
}

// ── soul ─────────────────────────────────────────────────────────────────────

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
  if (!content) throw new Error('SOUL.md not found. Run: node travel.js adopt <char_name>');

  // Support both 名字 and 角色名 field names
  const name = content
    .match(/(?:名字|角色名)[^：:\n]*[：:]\s*([^\n*]+)/)?.[1]
    ?.trim()
    ?.replace(/\*+/g, '')
    ?.replace(/\s*[（(][^）)]*[）)]$/, '')
    ?.trim();

  const picUuid = content
    .match(/\/picture\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)?.[1];

  if (!name) throw new Error('No 名字 or 角色名 field found in SOUL.md. Run adopt first.');
  out({ name, picture_uuid: picUuid ?? null });
}

// ── adopt ─────────────────────────────────────────────────────────────────────

else if (cmd === 'adopt') {
  const charName = args[0];
  if (!charName) throw new Error('Usage: travel.js adopt <char_name>');

  const query = stripParens(charName);
  log(`🔎 TCP search: "${query}"`);
  const search = await api('GET',
    `/v2/travel/parent-search?keywords=${encodeURIComponent(query)}&parent_type=oc&sort_scheme=exact&page_index=0&page_size=1`);
  const char = search.list?.find(r => r.type === 'oc');
  if (!char) throw new Error(`Character not found on Neta: "${query}"`);
  log(`✅ Found: ${char.name} (${char.uuid})`);

  // Fetch portrait from character's public feed
  let imageUrl = null;
  const feed = await api('GET',
    `/v1/home/feed/interactive?oc_uuid=${char.uuid}&page_index=0&page_size=10`);
  for (const m of (feed.module_list ?? [])) {
    for (const page of (m.json_data?.displayData?.pages ?? [])) {
      for (const img of (page.images ?? [])) {
        if (img.url?.includes('/picture/') && img.url?.endsWith('.webp')) {
          imageUrl = img.url; break;
        }
      }
      if (imageUrl) break;
    }
    if (imageUrl) break;
  }
  if (!imageUrl) throw new Error(`No portrait found in ${char.name}'s public feed.`);

  const soulPath = resolve(homedir(), '.openclaw/workspace/SOUL.md');
  writeFileSync(soulPath,
    `# ${char.name} — SOUL.md\n\n**名字**: ${char.name}\n**形象图片**: ${imageUrl}\n`, 'utf8');
  log(`📝 SOUL.md written: ${soulPath}`);

  const picUuid = imageUrl.match(/\/picture\/([0-9a-f-]{36})/)?.[1];
  out({ name: char.name, picture_uuid: picUuid });
}

// ── suggest ───────────────────────────────────────────────────────────────────

else if (cmd === 'suggest') {
  const exclude = (args[0] ?? '').split(',').filter(Boolean);

  // Priority 1: local scenes.json with SOUL.md tag scoring
  let refPick = null;
  for (const p of [
    resolve(homedir(), '.openclaw/workspace/skills/neta-travel/scenes.json'),
    resolve(homedir(), 'developer/neta-travel/scenes.json'),
    resolve(homedir(), 'developer/travelclaw/scenes.json'),
    resolve(__dir, 'scenes.json'),
  ]) {
    try {
      const scenes = JSON.parse(readFileSync(p, 'utf8'));
      const available = scenes.filter(s => s.collection_uuid && !exclude.includes(s.collection_uuid));
      if (!available.length) break;

      const soulText = (() => {
        for (const sp of [
          resolve(homedir(), '.openclaw/workspace/SOUL.md'),
          resolve(homedir(), 'developer/clawhouse/SOUL.md'),
        ]) {
          try { return readFileSync(sp, 'utf8'); } catch { /* try next */ }
        }
        return '';
      })();

      const soulWords = new Set(
        soulText.split(/[，、。\s,\n：:*【】（）()]+/).filter(w => w.length >= 2)
      );

      const scored = available.map(s => {
        let score = 0;
        for (const tag of s.content_tags ?? [])
          for (const w of soulWords) if (tag.includes(w) || w.includes(tag)) score += 2;
        for (const path of s.tax_paths ?? [])
          for (const w of soulWords) if (path.includes(w)) score += 1;
        return { s, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const top = scored.filter(x => x.score === scored[0].score);
      refPick = top[Math.floor(Math.random() * top.length)].s;
      break;
    } catch { /* file not found, try next */ }
  }

  if (refPick) {
    out({ uuid: refPick.collection_uuid, name: refPick.name, from_ref: true });
    process.exit(0);
  }

  // Priority 2: live API
  const data = await api('POST', '/v1/recsys/content', {
    page_index: 0, page_size: 20, scene: 'agent_intent',
    business_data: {
      intent: 'recommend', search_keywords: [], tax_paths: [],
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

// ── gen ───────────────────────────────────────────────────────────────────────

else if (cmd === 'gen') {
  const [charName, picUuid, collectionUuid] = args;
  if (!charName || !collectionUuid)
    throw new Error('Usage: travel.js gen <char_name> <pic_uuid> <collection_uuid>');

  // 1. Fetch scene
  const feedData = await api('GET',
    `/v1/home/feed/interactive?collection_uuid=${collectionUuid}&page_index=0&page_size=1`);
  const item = feedData.module_list?.[0];
  if (!item) throw new Error(`Scene not found: ${collectionUuid}`);

  const sceneName = item.json_data.name;
  const cta = item.json_data?.cta_info ?? {};
  let promptTemplate = cta.launch_prompt?.core_input ?? cta.choices?.[0]?.core_input ?? null;

  if (!promptTemplate && cta.interactive_config?.verse_uuid) {
    log('📖 Fetching verse preset...');
    const verse = await api('GET', `/v1/verse/preset/${cta.interactive_config.verse_uuid}`)
      .catch(() => null);
    promptTemplate = verse?.launch_prompt?.core_input ?? null;
  }

  if (!promptTemplate) promptTemplate = `@${charName}, ${sceneName}`;
  log(`🗺  Scene: ${sceneName}`);

  // 2. Replace placeholders
  let promptText = promptTemplate
    .replace(/\{@character\}/g, charName)
    .replace(/\{角色名称\}|\{角色名\}|（角色名称）/g, charName);

  // 3. TCP character lookup (strip parentheticals first)
  const charQuery = stripParens(charName);
  const search = await api('GET',
    `/v2/travel/parent-search?keywords=${encodeURIComponent(charQuery)}&parent_type=oc&sort_scheme=exact&page_index=0&page_size=1`);
  const char = search.list?.find(r => r.type === 'oc');
  log(`🔎 TCP: "${charQuery}" → ${char ? `found ${char.name}` : 'not found, using freetext'}`);

  // 4. Build vtokens
  const vtokens = [];
  if (char) {
    vtokens.push({ type: 'oc_vtoken_adaptor', uuid: char.uuid, name: char.name, value: char.uuid, weight: 1 });
    promptText = promptText.replace(new RegExp(`@${charName}[,，\\s]*`, 'g'), '').trim();
  }
  promptText = promptText.replace(/参考图-\S+/g, '').replace(/图片捏-\S+/g, '').trim();
  if (promptText) vtokens.push({ type: 'freetext', value: promptText, weight: 1 });
  log(`📝 vtokens: ${JSON.stringify(vtokens)}`);

  // 5. Submit image generation
  log('🎨 Generating travel image...');
  const taskUuid = await api('POST', '/v3/make_image', {
    storyId: 'DO_NOT_USE',
    jobType: 'universal',
    rawPrompt: vtokens,
    width: 576, height: 768,
    meta: { entrance: 'PICTURE,VERSE' },
    context_model_series: '8_image_edit',
    inherit_params: {
      collection_uuid: collectionUuid,
      ...(picUuid ? { picture_uuid: picUuid } : {}),
    },
  });

  const task_uuid = typeof taskUuid === 'string' ? taskUuid : taskUuid?.task_uuid;
  log(`⏳ Task: ${task_uuid}`);

  // 6. Poll (500ms interval, 3 min max)
  const result = await pollTask(task_uuid);

  if (result.task_status !== 'SUCCESS') {
    log(`⚠️  Gen ${result.task_status} — error_code: ${result.error_code ?? 'n/a'}, error_msg: ${result.error_msg ?? 'n/a'}`);
    log(`   artifacts: ${JSON.stringify(result.artifacts ?? [])}`);
  }

  out({
    scene: sceneName,
    task_uuid,
    status: result.task_status,
    url: result.artifacts?.[0]?.url ?? null,
    collection_uuid: collectionUuid,
  });
}

else {
  process.stderr.write(
    'Usage: node travel.js soul | adopt <char_name> | suggest [exclude_csv] | gen <char_name> <pic_uuid> <collection_uuid>\n'
  );
  process.exit(1);
}
