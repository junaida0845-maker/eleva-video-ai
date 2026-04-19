// Gemini API health check — admin-only, exposes which test failed and why.
// verify_jwt is intentionally false; access is via URL secrecy.

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

function tryParse(text: string) {
  try { return JSON.parse(text); } catch { return text.length > 800 ? text.substring(0, 800) + '\u2026' : text; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    let test = 0;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        test = Number(body?.test) || 0;
      } catch { /* allow query param fallback */ }
    }
    if (!test) {
      const url = new URL(req.url);
      test = Number(url.searchParams.get('test')) || 0;
    }

    const keyPreview = GEMINI_KEY ? GEMINI_KEY.substring(0, 12) + '\u2026' : 'MISSING';

    if (test === 1) {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': GEMINI_KEY },
      });
      const text = await res.text();
      const parsed = tryParse(text);
      const modelNames = (parsed && Array.isArray(parsed.models))
        ? parsed.models.map((m: { name?: string }) => m.name).filter(Boolean)
        : null;
      return new Response(JSON.stringify({
        test: 1,
        endpoint: 'GET /v1beta/models',
        status: res.status,
        ok: res.ok,
        has_gemini_key: GEMINI_KEY.length > 0,
        key_preview: keyPreview,
        model_count: modelNames ? modelNames.length : null,
        model_names: modelNames ? modelNames.slice(0, 60) : null,
        has_gemini_2_5_flash: modelNames ? modelNames.some((n: string) => n.includes('gemini-2.5-flash')) : null,
        has_gemini_2_5_flash_image: modelNames ? modelNames.some((n: string) => n.includes('gemini-2.5-flash-image')) : null,
        response: parsed,
      }, null, 2), { headers: cors, status: 200 });
    }

    if (test === 2) {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say hello in Japanese, 5 words max.' }] }],
          }),
        },
      );
      const text = await res.text();
      return new Response(JSON.stringify({
        test: 2,
        endpoint: 'POST /v1beta/models/gemini-2.5-flash:generateContent',
        status: res.status,
        ok: res.ok,
        has_gemini_key: GEMINI_KEY.length > 0,
        key_preview: keyPreview,
        response: tryParse(text),
      }, null, 2), { headers: cors, status: 200 });
    }

    if (test === 3) {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'A cute shiba inu eating breakfast' }] }],
            generationConfig: { responseModalities: ['Image'] },
          }),
        },
      );
      const text = await res.text();
      // Image response can be huge (base64); preview the first 1500 chars only.
      return new Response(JSON.stringify({
        test: 3,
        endpoint: 'POST /v1beta/models/gemini-2.5-flash-image:generateContent',
        status: res.status,
        ok: res.ok,
        has_gemini_key: GEMINI_KEY.length > 0,
        key_preview: keyPreview,
        response_bytes: text.length,
        response_preview: text.length > 1500 ? text.substring(0, 1500) + '\u2026' : text,
      }, null, 2), { headers: cors, status: 200 });
    }

    return new Response(JSON.stringify({ error: 'test must be 1, 2, or 3', received: test }), { headers: cors, status: 400 });
  } catch (e) {
    return new Response(JSON.stringify({
      error: 'gemini-health-check threw',
      detail: (e as Error)?.message || String(e),
      stack: (e as Error)?.stack,
    }, null, 2), { headers: cors, status: 500 });
  }
});
