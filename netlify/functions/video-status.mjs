const SUPABASE_URL = process.env.SUPABASE_URL || 'https://syxctolgqhdtcoaothwi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const PIAPI_KEY = process.env.PIAPI_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get('task_id') || url.searchParams.get('taskId');
    const generationId = url.searchParams.get('generation_id') || url.searchParams.get('generationId');

    if (!taskId) {
      return new Response(JSON.stringify({ error: 'task_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Directly poll PiAPI
    const piapiRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      headers: { 'x-api-key': PIAPI_KEY },
    });

    if (!piapiRes.ok) {
      // PiAPI unavailable — return pending so frontend retries
      return new Response(JSON.stringify({ status: 'pending', taskId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const d = await piapiRes.json();
    const status = d.data?.status ?? 'pending';
    const videoUrl =
      d.data?.output?.works?.[0]?.video?.resource ||
      d.data?.output?.video_url ||
      null;

    // Update Supabase if completed
    if (status === 'completed' && videoUrl && generationId && SERVICE_KEY) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/generations?id=eq.${generationId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ status: 'completed', video_url: videoUrl }),
        }
      );
    }

    const errMsg = d.data?.error?.message || d.data?.error?.raw_message || '';
    return new Response(JSON.stringify({ status, videoUrl, taskId, ...(errMsg && { error: errMsg }) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
};

export const config = { path: '/api/video-status' };
