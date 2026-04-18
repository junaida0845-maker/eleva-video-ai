// YouTube OAuth 開始（Google OAuth 2.0）
export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
  const REDIRECT_URI = `${process.env.URL}/auth/youtube/callback`;

  if (!CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'YouTube OAuth未設定' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const state = crypto.randomUUID();
  const scope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return new Response(JSON.stringify({ url: authUrl.toString(), state }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/youtube-auth-start' };
