const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://syxctolgqhdtcosothwi.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const CLAUDE_MODEL = 'claude-opus-4-6';

const CATEGORY_KEYS = new Set(['料理', '美容', 'フィットネス', '旅行', 'ビジネス', 'エンタメ']);

// Supabase tables this function reads (create if missing):
//   trend_cache (
//     id uuid primary key default gen_random_uuid(),
//     category text not null,
//     source text not null,           -- 'youtube' | 'buzz_posts' | 'trending_hashtags'
//     title text,
//     description text,
//     metrics jsonb,                   -- { viewCount, likeCount, ... }
//     refreshed_at timestamptz not null default now()
//   );
//   create index on trend_cache (category, refreshed_at desc);

async function fetchTrendContext(category) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return [];

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const sources = [
    `${SUPABASE_URL}/rest/v1/buzz_posts?select=title,description,metrics&category=eq.${encodeURIComponent(category)}&order=created_at.desc&limit=10`,
    `${SUPABASE_URL}/rest/v1/trending_hashtags?select=tag,volume&category=eq.${encodeURIComponent(category)}&order=volume.desc&limit=10`,
    `${SUPABASE_URL}/rest/v1/trend_cache?select=title,description,metrics&category=eq.${encodeURIComponent(category)}&order=refreshed_at.desc&limit=10`,
  ];

  const results = [];
  for (const url of sources) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length) results.push(...rows);
      }
    } catch {
      // ignore missing tables / network errors
    }
  }
  return results;
}

function buildPrompt(category, trendRows) {
  const trendSummary = trendRows.length
    ? JSON.stringify(trendRows).slice(0, 4000)
    : '(トレンドデータなし — カテゴリの一般的なバズ要素から推定してください)';

  return `あなたは縦型ショート動画のバズ戦略家です。以下のカテゴリとトレンドデータを元に、シナリオを3パターン提案してください。

# カテゴリ
${category}

# 最近のバズデータ
${trendSummary}

# 要件
- 各パターンは「アングル」「尺（秒数）」「構図」が異なること
- 各パターンは同じシーン数（4シーン）を持つこと
- 各シーンに: scene番号、duration（秒）、撮影指示、セリフ/テロップ案 を含める
- 実際に撮影可能な具体的指示であること

# 出力フォーマット（JSONのみ、説明文は不要）
{
  "patterns": [
    {
      "id": 1,
      "angle": "アングルの説明（例: 俯瞰固定 / ハンドヘルド追従）",
      "duration": 数値（秒）,
      "composition": "構図の説明（例: 三分割下寄せ / センター日の丸）",
      "hook": "最初の1秒のフック",
      "scenes": [
        { "scene": 1, "duration": 秒, "direction": "撮影指示", "caption": "テロップ/セリフ" }
      ]
    }
  ]
}`;
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Claude API error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return text;
}

function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in Claude response');
  return JSON.parse(candidate.slice(start, end + 1));
}

export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    const { category } = await req.json();
    if (!category || !CATEGORY_KEYS.has(category)) {
      return new Response(
        JSON.stringify({
          error: `category must be one of: ${Array.from(CATEGORY_KEYS).join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const trendRows = await fetchTrendContext(category);
    const prompt = buildPrompt(category, trendRows);
    const raw = await callClaude(prompt);
    const parsed = extractJson(raw);

    return new Response(
      JSON.stringify({
        category,
        trendsUsed: trendRows.length,
        patterns: parsed.patterns || [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
};

export const config = { path: '/api/generate-scenario' };
