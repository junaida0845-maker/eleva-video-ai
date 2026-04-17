export default async (req, context) => {
  const APP_ID = process.env.META_APP_ID;
  const REDIRECT_URI = `${process.env.URL}/api/instagram-auth-callback`;

  if (!APP_ID) {
    return new Response('META_APP_ID not configured', { status: 500 });
  }

  const state = generateState();
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'instagram_basic,instagram_manage_insights,pages_show_list',
    response_type: 'code',
    state: state,
  });

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': `ig_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
  });
};

function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/[^a-zA-Z0-9]/g, '');
}

export const config = { path: '/api/instagram-auth-start' };
