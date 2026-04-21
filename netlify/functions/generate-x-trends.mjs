const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

const LANG_NAMES = {
  ja: '日本語', 'en-us': 'English', ko: '한국어', 'zh-tw': '繁體中文', 'zh-cn': '简体中文',
  th: 'ไทย', vi: 'Tiếng Việt', id: 'Bahasa Indonesia', de: 'Deutsch', fr: 'Français',
  es: 'Español', 'pt-br': 'Português',
};
const LOCALE_TO_COUNTRY = {
  ja: '日本', 'en-us': 'アメリカ', 'en-gb': 'イギリス', ko: '韓国', 'zh-tw': '台湾', 'zh-cn': '中国',
  th: 'タイ', vi: 'ベトナム', id: 'インドネシア', de: 'ドイツ', fr: 'フランス', es: 'スペイン',
  'es-mx': 'メキシコ', 'pt-br': 'ブラジル',
};

function buildPrompt({ lang, genreKeyword }) {
  const langName = LANG_NAMES[lang] || LANG_NAMES.ja;
  const countryName = LOCALE_TO_COUNTRY[lang] || '日本';
  const genreHint = genreKeyword
    ? `\nユーザーが特に興味を持っているジャンル: 「${genreKeyword}」。このジャンルに関連したトピックを2-3件含めてください。`
    : '';
  return `あなたはリアルタイムのSNSトレンドアナリストです。今日の${countryName}のX（旧Twitter）でバズっているトピックを推定して、カテゴリ別に10件生成してください。

要件:
- 出力言語: ${langName}
- 時事・政治、スポーツ、エンタメ、ビジネス・経済、テック、カルチャー、ミーム等を幅広くカバー
- それぞれ具体性のあるトピックにする（単なるジャンル名にしない）
- ハッシュタグは日本語でも英語でも構わない、Xで実際に使われそうな形式${genreHint}

出力フォーマット（JSONのみ、前置き・後書き・説明文一切なし）:
{
  "topics": [
    {
      "title": "トピック名（最大30文字）",
      "category": "時事|スポーツ|エンタメ|ビジネス|テック|カルチャー|ミーム",
      "description": "このトピックがなぜバズっているかの1行説明（60文字以内）",
      "hashtag": "#関連ハッシュタグ",
      "heat": "high|medium|low"
    }
  ]
}

推定精度より「それっぽさ」を優先。具体的な固有名詞や数字を使い、Xらしい口語トーンにしてください。`;
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function tryParseJson(text) {
  if (!text) return null;
  // Strip ```json fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // Greedy fallback: pick the first {...} block
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return null;
}

export default async (req) => {
  const headers = { 'Content-Type': 'application/json', ...cors() };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500, headers });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const lang = (body.lang || 'ja').toLowerCase();
  const genreKeyword = (body.genre || '').slice(0, 40) || null;

  const prompt = buildPrompt({ lang, genreKeyword });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: 'anthropic_error', detail: errText.slice(0, 500) }), { status: 502, headers });
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const parsed = tryParseJson(text);

    if (!parsed || !Array.isArray(parsed.topics)) {
      return new Response(JSON.stringify({ error: 'parse_failed', raw: text.slice(0, 800) }), { status: 502, headers });
    }

    return new Response(JSON.stringify({
      topics: parsed.topics,
      generated_at: new Date().toISOString(),
      source: 'claude-sonnet-4',
      lang,
    }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers });
  }
};
