import { createClient } from '@supabase/supabase-js';

// TikTok OAuth コールバック
export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
  const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
  const REDIRECT_URI = `${process.env.URL}/api/tiktok-auth-callback`;
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const userId = url.searchParams.get('userId') || url.searchParams.get('user_id');

  if (!code) {
    return Response.redirect(`${process.env.URL}/settings.html?sns_error=tiktok_no_code`);
  }

  try {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      })
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error('TikTokトークン取得失敗');
    }

    const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    const tiktokUser = userData.data?.user;

    if (userId) {
      await sb.from('user_sns_accounts').upsert({
        user_id: userId,
        platform: 'tiktok',
        account_id: tiktokUser?.open_id,
        account_name: tiktokUser?.display_name,
        avatar_url: tiktokUser?.avatar_url,
        follower_count: tiktokUser?.follower_count || 0,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' });
    }

    return Response.redirect(`${process.env.URL}/settings.html?sns_connected=tiktok`);
  } catch (err) {
    console.error('TikTok auth error:', err);
    return Response.redirect(`${process.env.URL}/settings.html?sns_error=tiktok_failed`);
  }
};

export const config = { path: '/api/tiktok-auth-callback' };
