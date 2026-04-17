const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!YOUTUBE_API_KEY) {
    return new Response(JSON.stringify({ error: 'YOUTUBE_API_KEY is not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q');
    const maxResults = Math.min(parseInt(url.searchParams.get('max') || '12', 10), 50);
    const duration = url.searchParams.get('duration') || 'short';
    const order = url.searchParams.get('order') || 'relevance';
    const regionCode = url.searchParams.get('region') || '';
    const hl = url.searchParams.get('hl') || '';

    if (!q) {
      return new Response(JSON.stringify({ error: 'q (query) is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('q', q);
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('videoDuration', duration);
    searchUrl.searchParams.set('videoEmbeddable', 'true');
    searchUrl.searchParams.set('safeSearch', 'moderate');
    searchUrl.searchParams.set('order', order);
    if (regionCode) searchUrl.searchParams.set('regionCode', regionCode);
    if (hl) searchUrl.searchParams.set('relevanceLanguage', hl);
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      return new Response(JSON.stringify({ error: `YouTube API error: ${errText}` }), {
        status: searchRes.status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
    const searchData = await searchRes.json();
    const ids = (searchData.items || []).map((it) => it.id?.videoId).filter(Boolean);

    let details = {};
    if (ids.length > 0) {
      const detailUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      detailUrl.searchParams.set('part', 'contentDetails,statistics');
      detailUrl.searchParams.set('id', ids.join(','));
      detailUrl.searchParams.set('key', YOUTUBE_API_KEY);
      const detailRes = await fetch(detailUrl);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        for (const v of detailData.items || []) {
          details[v.id] = {
            duration: v.contentDetails?.duration,
            viewCount: v.statistics?.viewCount,
            likeCount: v.statistics?.likeCount,
          };
        }
      }
    }

    const clips = (searchData.items || []).map((it) => {
      const id = it.id?.videoId;
      const s = it.snippet || {};
      return {
        videoId: id,
        title: s.title,
        description: s.description,
        channelTitle: s.channelTitle,
        publishedAt: s.publishedAt,
        thumbnail:
          s.thumbnails?.high?.url ||
          s.thumbnails?.medium?.url ||
          s.thumbnails?.default?.url ||
          null,
        url: id ? `https://www.youtube.com/watch?v=${id}` : null,
        embedUrl: id ? `https://www.youtube.com/embed/${id}` : null,
        ...(details[id] || {}),
      };
    });

    return new Response(
      JSON.stringify({ query: q, count: clips.length, clips }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
};

export const config = { path: '/api/youtube-search' };
