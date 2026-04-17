import { createClient } from '@supabase/supabase-js';

export default async (req, context) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return new Response(null, { status: 302, headers: { Location: '/follower-growth.html?error=ig_auth_failed' } });
  }

  const cookies = Object.fromEntries(
    (req.headers.get('cookie') || '').split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
  if (state !== cookies['ig_state']) {
    return new Response(null, { status: 302, headers: { Location: '/follower-growth.html?error=state_mismatch' } });
  }

  const APP_ID = process.env.META_APP_ID;
  const APP_SECRET = process.env.META_APP_SECRET;
  const REDIRECT_URI = `${process.env.URL}/api/instagram-auth-callback`;

  try {
    const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token');

    const ltRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokenData.access_token}`);
    const ltData = await ltRes.json();
    const longToken = ltData.access_token || tokenData.access_token;

    const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${longToken}`);
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    let igAccount = null;
    for (const page of pages) {
      const igRes = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
      const igData = await igRes.json();
      if (igData.instagram_business_account?.id) {
        const detailRes = await fetch(`https://graph.facebook.com/v18.0/${igData.instagram_business_account.id}?fields=username,followers_count,media_count&access_token=${page.access_token}`);
        const detail = await detailRes.json();
        igAccount = { ...detail, page_token: page.access_token };
        break;
      }
    }

    if (!igAccount) throw new Error('No Instagram business account found');

    const authHeader = req.headers.get('x-supabase-auth') || '';
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user } } = await sb.auth.getUser(authHeader);

    if (user) {
      const followerCount = igAccount.followers_count || 0;
      await sb.from('user_sns_accounts').upsert({
        user_id: user.id,
        platform: 'instagram',
        account_name: igAccount.username,
        account_id: igAccount.id,
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
        Location: '/follower-growth.html?connected=instagram',
        'Set-Cookie': 'ig_state=; Path=/; HttpOnly; Max-Age=0',
      },
    });
  } catch (err) {
    console.error('Instagram OAuth error:', err);
    return new Response(null, { status: 302, headers: { Location: '/follower-growth.html?error=ig_auth_error' } });
  }
};

export const config = { path: '/api/instagram-auth-callback' };
