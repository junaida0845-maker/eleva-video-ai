const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

const LANG_NAMES = {
  ja: '日本語', 'en-us': 'English', ko: '한국어', 'zh-tw': '繁體中文', 'zh-cn': '简体中文',
  th: 'ไทย', vi: 'Tiếng Việt', id: 'Bahasa Indonesia', de: 'Deutsch', fr: 'Français',
  es: 'Español', 'pt-br': 'Português',
};

function buildPrompt({ title, genre, platform, lang }) {
  const langName = LANG_NAMES[lang] || LANG_NAMES['ja'];
  return `あなたはSNSマーケティングの専門家です。以下の条件でキャプションとハッシュタグを生成してください。

動画タイトル: ${title || '(未設定)'}
ジャンル: ${genre || 'general'}
投稿先SNS: ${platform || 'instagram'}
出力言語: ${langName}

要件:
- キャプション: ${platform === 'x' ? '140文字以内' : '150文字以内'}、${langName}で記述、絵文字を適度に使用
- ハッシュタグ: 20〜30個、${langName}のトレンドに合わせたもの
- ${platform}のアルゴリズムに最適化

出力フォーマット（JSONのみ、説明文不要）:
{"caption":"キャプションテキスト","hashtags":["#tag1","#tag2",...]}`;
}

export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    const { title, genre, platform, lang } = await req.json();
    const prompt = buildPrompt({ title, genre, platform: platform || 'instagram', lang: lang || 'ja' });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fence ? fence[1] : text;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    const parsed = start >= 0 && end >= 0 ? JSON.parse(candidate.slice(start, end + 1)) : { caption: text, hashtags: [] };

    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
};

export const config = { path: '/api/generate-caption' };
