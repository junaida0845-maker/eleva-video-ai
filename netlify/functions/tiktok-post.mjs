// TikTok Content Posting API — Direct Post with AI disclosure.
// Endpoint reference: POST https://open.tiktokapis.com/v2/post/publish/video/init/
//
// Disclosure fields sent on every post:
//   - is_aigc: true                 // AI-generated content label (required for ELEVA)
//   - aigc_disclosure: true         // alias accepted by some API versions; TikTok ignores unknown fields
//   - commercial_content_toggle     // true when any commercial disclosure is selected
//   - brand_organic_toggle          // user's own brand promotion
//   - brand_content_toggle          // paid partnership / third-party brand
//
// Required env:
//   TIKTOK_ACCESS_TOKEN   — per-creator OAuth access token (scope: video.publish)
// Optional env:
//   TIKTOK_DEFAULT_PRIVACY — PUBLIC_TO_EVERYONE | MUTUAL_FOLLOW_FRIENDS | SELF_ONLY
//
// AI disclosure is recorded in public.generations.metadata.ai_disclosed (jsonb field, no DDL required).

const TIKTOK_ENDPOINT = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
const DEFAULT_PRIVACY = process.env.TIKTOK_DEFAULT_PRIVACY || 'SELF_ONLY';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://syxctolgqhdtcoaothwi.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function normalizeCommercial(choice) {
  // choice: 'brand_organic' | 'brand_content' | 'none'
  const brand_organic_toggle = choice === 'brand_organic';
  const brand_content_toggle = choice === 'brand_content';
  const commercial_content_toggle = brand_organic_toggle || brand_content_toggle;
  return { brand_organic_toggle, brand_content_toggle, commercial_content_toggle };
}

function buildPayload({ videoUrl, title, commercial, privacy }) {
  const c = normalizeCommercial(commercial);
  return {
    post_info: {
      title: title || '',
      privacy_level: privacy || DEFAULT_PRIVACY,
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000,
      is_aigc: true,
      aigc_disclosure: true,
      commercial_content_toggle: c.commercial_content_toggle,
      brand_organic_toggle: c.brand_organic_toggle,
      brand_content_toggle: c.brand_content_toggle,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: videoUrl,
    },
  };
}

async function markDisclosed(generationId) {
  if (!generationId || !SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/generations?id=eq.${encodeURIComponent(generationId)}&select=metadata`,
      { headers }
    );
    const rows = await getRes.json();
    const metadata = { ...(rows?.[0]?.metadata || {}), ai_disclosed: true };
    await fetch(
      `${SUPABASE_URL}/rest/v1/generations?id=eq.${encodeURIComponent(generationId)}`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ metadata }),
      }
    );
  } catch { /* best-effort audit trail */ }
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

  const accessToken = process.env.TIKTOK_ACCESS_TOKEN || '';
  if (!accessToken) {
    return new Response(
      JSON.stringify({
        error:
          'TIKTOK_ACCESS_TOKEN is not set. Complete the TikTok Login Kit OAuth flow and store the per-user access token before calling this endpoint.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }

  try {
    const body = await req.json();
    const { videoUrl, title, commercial, privacy, generationId } = body || {};
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: 'videoUrl is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const payload = buildPayload({ videoUrl, title, commercial, privacy });

    const res = await fetch(TIKTOK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: 'TikTok API error', status: res.status, data }),
        { status: res.status, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    await markDisclosed(generationId);

    return new Response(
      JSON.stringify({
        ok: true,
        publish_id: data?.data?.publish_id || null,
        disclosure: {
          is_aigc: true,
          ...normalizeCommercial(commercial),
        },
        tiktok: data,
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

export const config = { path: '/api/tiktok-post' };
