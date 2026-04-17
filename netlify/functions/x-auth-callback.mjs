import { createClient } from '@supabase/supabase-js';

export default async (req, context) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return new Response(null, { status: 302, headers: { Location: '/follower-growth.html?error=x_auth_failed' } });
  }

  const cookies = Object.fromEntries(
    (req.headers.get('cookie') || '').split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
  const codeVerifier = cookies['x_code_verifier'];
  const savedState = cookies['x_state'];

  if (!codeVerifier || state !== savedState) {
    return new Response(null, { status: 302, headers: { Location: '/follower-growth.html?error=state_mismatch' } });
  }

  const CLIENT_ID = process.env.X_API_KEY;
  const CLIENT_SECRET = process.env.X_API_SECRET;
  const REDIRECT_URI = `${process.env.URL}/api/x-auth-callback`;

  try {
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token');

    const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    const xUser = userData.data;

    const authHeader = req.headers.get('x-supabase-auth') || '';

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user } } = await sb.auth.getUser(authHeader);

    if (user) {
      const followerCount = xUser.public_metrics?.followers_count || 0;

      await sb.from('user_sns_accounts').upsert({
        user_id: user.id,
        platform: 'x',
        account_name: xUser.username,
        account_id: xUser.id,
        follower_count: followerCount,
        registered_follower_count: followerCount,
        account_type: 'existing',
        registered_at: new Date().toISOString(),
        is_active: true,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform,account_name' });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/follower-growth.html?connected=x',
        'Set-Cookie': [
          'x_code_verifier=; Path=/; HttpOnly; Max-Age=0',
          'x_state=; Path=/; HttpOnly; Max-Age=0',
        ].join(', '),
      },
    });
  } catch (err) {
    console.error('X OAuth error:', err);
    return new Response(null, { status: 302, headers: { Location: '/follower-growth.html?error=x_auth_error' } });
  }
};

export const config = { path: '/api/x-auth-callback' };
