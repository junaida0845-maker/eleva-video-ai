import { createClient } from '@supabase/supabase-js';

// YouTube OAuth コールバック
export default async (req) => {
  const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
  const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
  const REDIRECT_URI = `${process.env.URL}/auth/youtube/callback`;
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const userId = url.searchParams.get('state'); // stateにuserIdを埋め込む

  if (!code) {
    return Response.redirect(`${process.env.URL}/settings.html?sns_error=youtube_no_code`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      })
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error('YouTubeトークン取得失敗');
    }

    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    if (userId) {
      await sb.from('user_sns_accounts').upsert({
        user_id: userId,
        platform: 'youtube',
        account_id: channel?.id,
        account_name: channel?.snippet?.title,
        avatar_url: channel?.snippet?.thumbnails?.default?.url,
        follower_count: parseInt(channel?.statistics?.subscriberCount || '0'),
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' });
    }

    return Response.redirect(`${process.env.URL}/settings.html?sns_connected=youtube`);
  } catch (err) {
    console.error('YouTube auth error:', err);
    return Response.redirect(`${process.env.URL}/settings.html?sns_error=youtube_failed`);
  }
};

export const config = { path: '/auth/youtube/callback' };
