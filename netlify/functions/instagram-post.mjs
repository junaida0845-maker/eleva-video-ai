// Instagram Graph API — Publish Reels / Video with AI disclosure hashtag.
//
// Flow (two-step):
//   1. POST /{ig-user-id}/media         → returns creation_id
//   2. Poll GET  /{creation-id}?fields=status_code  until FINISHED
//   3. POST /{ig-user-id}/media_publish → publishes the creation_id
//
// AI disclosure:
//   The Graph API does NOT currently expose a first-class AI-generated label
//   parameter. When autoTagAI is true (default), "#AI生成 #AIGC" is appended
//   to the caption. Creators can additionally apply the in-app AI label
//   manually after publishing. Some newer API versions accept
//   `ai_disclosure_label: "AI_GENERATED"` — we send it optimistically and
//   Meta ignores the field if unsupported.
//
// Required env:
//   META_ACCESS_TOKEN           — Page access token with instagram_content_publish
//   IG_BUSINESS_ACCOUNT_ID      — Instagram Business Account ID (defaults; can be overridden via body)
// Optional env:
//   META_GRAPH_VERSION          — e.g. v18.0 (default)

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v18.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://syxctolgqhdtcoaothwi.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const AI_TAGS = '#AI生成 #AIGC';

function applyAITag(caption, autoTagAI) {
  const base = (caption || '').trim();
  if (!autoTagAI) return base;
  if (/#AI生成|#AIGC/i.test(base)) return base;
  return base ? `${base}\n\n${AI_TAGS}` : AI_TAGS;
}

async function createMediaContainer({ igUserId, accessToken, videoUrl, caption, mediaType }) {
  const url = `${GRAPH_BASE}/${igUserId}/media`;
  const params = new URLSearchParams({
    access_token: accessToken,
    media_type: mediaType || 'REELS',
    video_url: videoUrl,
    caption: caption || '',
    ai_disclosure_label: 'AI_GENERATED',
  });
  const res = await fetch(url, { method: 'POST', body: params });
  const data = await res.json();
  if (!res.ok) throw new Error(`media create failed: ${JSON.stringify(data)}`);
  return data.id;
}

async function waitForContainerReady(creationId, accessToken, maxTries = 20) {
  for (let i = 0; i < maxTries; i++) {
    const res = await fetch(
      `${GRAPH_BASE}/${creationId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await res.json();
    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`container status: ${data.status_code}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('container never became ready (timeout)');
}

async function publishContainer({ igUserId, accessToken, creationId }) {
  const url = `${GRAPH_BASE}/${igUserId}/media_publish`;
  const params = new URLSearchParams({ access_token: accessToken, creation_id: creationId });
  const res = await fetch(url, { method: 'POST', body: params });
  const data = await res.json();
  if (!res.ok) throw new Error(`media publish failed: ${JSON.stringify(data)}`);
  return data.id;
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

  const accessToken = process.env.META_ACCESS_TOKEN || '';
  const envIgId = process.env.IG_BUSINESS_ACCOUNT_ID || '';

  if (!accessToken) {
    return new Response(
      JSON.stringify({
        error:
          'META_ACCESS_TOKEN is not set. Complete the Meta Business / Facebook Login OAuth flow and store the Page access token (with instagram_content_publish) before calling this endpoint.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }

  try {
    const body = await req.json();
    const {
      videoUrl,
      caption,
      autoTagAI = true,
      igBusinessAccountId,
      mediaType,
      generationId,
    } = body || {};
    const igUserId = igBusinessAccountId || envIgId;
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: 'videoUrl is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
    if (!igUserId) {
      return new Response(
        JSON.stringify({
          error: 'igBusinessAccountId is required (or set IG_BUSINESS_ACCOUNT_ID env)',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const finalCaption = applyAITag(caption, autoTagAI);

    const creationId = await createMediaContainer({
      igUserId,
      accessToken,
      videoUrl,
      caption: finalCaption,
      mediaType,
    });
    await waitForContainerReady(creationId, accessToken);
    const mediaId = await publishContainer({ igUserId, accessToken, creationId });

    await markDisclosed(generationId);

    return new Response(
      JSON.stringify({
        ok: true,
        media_id: mediaId,
        caption: finalCaption,
        disclosure: { autoTagAI, ai_disclosure_label: 'AI_GENERATED' },
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

export const config = { path: '/api/instagram-post' };
