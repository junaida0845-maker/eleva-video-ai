const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://syxctolgqhdtcoaothwi.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const CATEGORIES = {
  '料理': 'cooking recipe short',
  '美容': 'beauty makeup tutorial',
  'フィットネス': 'fitness workout',
  '旅行': 'travel vlog',
  'ビジネス': 'business tips productivity',
  'エンタメ': 'entertainment viral',
};

const REGIONS = ['JP', 'US', 'KR', 'TW', 'TH', 'VN', 'ID', 'DE', 'FR', 'ES', 'BR'];

async function fetchYoutubeTop(query, n = 15, regionCode = '') {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(n));
  url.searchParams.set('videoDuration', 'short');
  url.searchParams.set('order', 'viewCount');
  url.searchParams.set('publishedAfter', new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString());
  if (regionCode) url.searchParams.set('regionCode', regionCode);
  url.searchParams.set('key', YOUTUBE_API_KEY);
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}

async function upsertRows(rows) {
  if (!rows.length) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trend_cache`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error('trend_cache insert failed', res.status, await res.text());
    return 0;
  }
  return rows.length;
}

async function clearCategory(category) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/trend_cache?category=eq.${encodeURIComponent(category)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal',
      },
    }
  ).catch(() => {});
}

export default async () => {
  if (!YOUTUBE_API_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'YOUTUBE_API_KEY or SUPABASE_SERVICE_ROLE_KEY not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const summary = {};
  for (const [category, query] of Object.entries(CATEGORIES)) {
    try {
      await clearCategory(category);
      let allRows = [];
      for (const region of ['JP', 'US']) {
        const items = await fetchYoutubeTop(query, 10, region);
        const rows = items.map((it) => ({
          category,
          source: 'youtube',
          title: it.snippet?.title || '',
          description: (it.snippet?.description || '').slice(0, 500),
          metrics: {
            channelTitle: it.snippet?.channelTitle || '',
            publishedAt: it.snippet?.publishedAt || '',
            videoId: it.id?.videoId || '',
            region,
          },
        }));
        allRows.push(...rows);
      }
      const rows = allRows;
      summary[category] = await upsertRows(rows);
    } catch (err) {
      summary[category] = `error: ${err.message}`;
    }
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Weekly: Mondays 00:00 UTC (~09:00 JST)
export const config = { schedule: '0 0 * * 1' };
