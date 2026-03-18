/**
 * neta-avatar-search.js — character portrait lookup via Neta TCP API
 *
 * Replaces the neta-skills CLI dependency with direct HTTP calls,
 * using the same approach as travel.js adopt:
 *   1. /v2/travel/parent-search  → find character UUID
 *   2. /v1/home/feed/interactive?oc_uuid=... → get portrait picture URL
 *
 * No neta-skills installation required.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Token resolution (mirrors travel.js) ─────────────────────────────────────

function getToken() {
  if (process.env.NETA_TOKEN) return process.env.NETA_TOKEN;
  const candidates = [
    path.join(os.homedir(), '.openclaw/workspace/.env'),
    path.join(os.homedir(), 'developer/clawhouse/.env'),
  ];
  for (const p of candidates) {
    try {
      const m = fs.readFileSync(p, 'utf8').match(/NETA_TOKEN=(.+)/);
      if (m) return m[1].trim();
    } catch { /* try next */ }
  }
  throw new Error('NETA_TOKEN not found. Add it to ~/.openclaw/workspace/.env');
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function apiGet(urlPath) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const options = {
      hostname: 'api.talesofai.cn',
      path: urlPath,
      method: 'GET',
      headers: {
        'x-token': token,
        'x-platform': 'nieta-app/web',
        'content-type': 'application/json',
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Validate image URL ────────────────────────────────────────────────────────

function isValidImageUrl(url) {
  return new Promise(resolve => {
    if (!url) return resolve(false);
    const mod = url.startsWith('https') ? https : require('http');
    const req = mod.get(url, { timeout: 5000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return isValidImageUrl(res.headers.location).then(resolve);
      }
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ── Core search ───────────────────────────────────────────────────────────────

/**
 * Search for a character portrait using Neta TCP API.
 *
 * @param {string} characterName - character name (e.g. "可莉")
 * @param {string} from - work/series name (e.g. "原神") — used for fallback queries
 * @returns {Promise<{name, avatar, source, keywords}|null>}
 */
async function searchCharacter(characterName, from) {
  // Strip parentheticals (e.g. "纳西妲 (小吉祥草王)" → "纳西妲")
  const query = characterName.replace(/\s*[（(][^）)]*[）)]/g, '').trim();

  // Build keyword list: plain name first, then with series
  const keywords = [query];
  if (from) {
    const cleanFrom = from.replace(/[《》]/g, '').trim();
    if (cleanFrom) keywords.push(`${query} ${cleanFrom}`);
  }

  for (const kw of keywords) {
    try {
      const encoded = encodeURIComponent(kw);
      const searchRes = await apiGet(
        `/v2/travel/parent-search?keywords=${encoded}&parent_type=oc&sort_scheme=exact&page_index=0&page_size=3`
      );
      const char = (searchRes.list ?? []).find(r => r.type === 'oc');
      if (!char) continue;

      // Fetch portrait from the character's public image feed
      const feedRes = await apiGet(
        `/v1/home/feed/interactive?oc_uuid=${char.uuid}&page_index=0&page_size=10`
      );

      for (const m of (feedRes.module_list ?? [])) {
        for (const page of (m.json_data?.displayData?.pages ?? [])) {
          for (const img of (page.images ?? [])) {
            if (img.url?.includes('/picture/') && img.url?.endsWith('.webp')) {
              const valid = await isValidImageUrl(img.url);
              if (valid) {
                return { name: char.name, avatar: img.url, source: 'Neta TCP', keywords: kw };
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[neta-avatar] search failed (${kw}): ${err.message}`);
    }
  }

  return null;
}

module.exports = { searchCharacter, isValidImageUrl };
