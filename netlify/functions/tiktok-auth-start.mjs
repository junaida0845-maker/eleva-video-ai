// TikTok OAuth 開始
export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
  const REDIRECT_URI = `${process.env.URL}/api/tiktok-auth-callback`;

  if (!CLIENT_KEY) {
    return new Response(JSON.stringify({ error: 'TikTok API未設定' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const state = crypto.randomUUID();
  const scope = 'user.info.basic,video.upload,video.publish';

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', CLIENT_KEY);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', state);

  return new Response(JSON.stringify({ url: authUrl.toString(), state }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/tiktok-auth-start' };
