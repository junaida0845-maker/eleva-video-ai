const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

const LANG_NAMES = {
  ja: '日本語', 'en-us': 'English', ko: '한국어', 'zh-tw': '繁體中文', 'zh-cn': '简体中文',
  th: 'ไทย', vi: 'Tiếng Việt', id: 'Bahasa Indonesia', de: 'Deutsch', fr: 'Français',
  es: 'Español', 'pt-br': 'Português', it: 'Italiano',
};

function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in response');
  return JSON.parse(candidate.slice(start, end + 1));
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
    const { genre, platform, lang, userPrompt = '', target = '', style = '', trendingHashtags = [], trendingTopics = [], hasMedia = false } = await req.json();
    const langName = LANG_NAMES[lang] || LANG_NAMES['ja'];
    const langInstruction = lang && lang !== 'ja'
      ? `\nAll text fields (title/concept/reason/prompt_localized) must be written in ${langName}. JSON keys stay in English.`
      : '';

    const system = `あなたはSNS動画のプロデューサーです。ユーザーのテーマ・ターゲット・スタイルとトレンドデータを元に、バズりやすい動画コンセプトを3案提案してください。ユーザーが具体的なテーマを入力している場合は、その意図を最優先してください。${langInstruction}
返答は以下のJSON形式のみ（説明文不要）:
{
  "proposals": [
    {
      "title": "案のタイトル（20文字以内）",
      "concept": "どんな動画か（60文字以内）",
      "reason": "なぜバズるか（40文字以内）",
      "prompt_localized": "動画生成用のプロンプト（50文字、ユーザー言語）"
    }
  ]
}`;

    const userMsg = `ジャンル: ${genre || 'general'}
プラットフォーム: ${platform || 'tiktok'}
言語: ${langName}
${userPrompt ? `ユーザーのテーマ・目的: ${userPrompt}` : ''}
${target ? `ターゲット: ${target}` : ''}
${style ? `希望スタイル・雰囲気: ${style}` : ''}
トレンドハッシュタグ: ${trendingHashtags.slice(0, 5).join(', ') || 'なし'}
トレンドトピック: ${trendingTopics.slice(0, 3).join(' / ') || 'なし'}
${hasMedia ? '※ユーザーは参考画像/動画をアップロード済み' : ''}`;

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
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const parsed = extractJson(text);

    return new Response(JSON.stringify({ proposals: parsed.proposals || [] }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
};

export const config = { path: '/api/generate-proposals' };
