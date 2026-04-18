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
    const { currentPrompt, currentConcept, userMessage, history = [], lang } = await req.json();
    const langName = LANG_NAMES[lang] || LANG_NAMES['ja'];

    const system = `あなたはSNS動画プロデューサーです。ユーザーの修正要望を受けて動画コンセプトを更新してください。
返答は以下のJSON形式のみ（説明文不要、出力言語は ${langName}）:
{"reply": "ユーザーへの返答（${langName}）", "updated_concept": "更新されたコンセプト（60文字）", "updated_prompt": "更新されたプロンプト（50文字）"}`;

    const messages = [
      ...history.slice(-6),
      {
        role: 'user',
        content: `現在のコンセプト: ${currentConcept || '(なし)'}\n現在のプロンプト: ${currentPrompt}\n\n修正要望: ${userMessage}`,
      },
    ];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const parsed = extractJson(text);

    return new Response(JSON.stringify({
      reply: parsed.reply || '',
      updated_concept: parsed.updated_concept || currentConcept,
      updated_prompt: parsed.updated_prompt || currentPrompt,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
};

export const config = { path: '/api/refine-concept' };
