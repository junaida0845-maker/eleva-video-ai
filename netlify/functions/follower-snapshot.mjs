import { createClient } from '@supabase/supabase-js';

export default async (req, context) => {
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data: accounts, error } = await sb
      .from('user_sns_accounts')
      .select('id, user_id, platform, follower_count, avg_likes, avg_views')
      .eq('is_active', true);

    if (error) throw error;
    if (!accounts?.length) {
      return new Response(JSON.stringify({ message: 'No active accounts', count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    let success = 0, failed = 0;

    for (const acc of accounts) {
      try {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthStr = lastMonth.toISOString().slice(0, 7);

        const { data: prev } = await sb
          .from('follower_snapshots')
          .select('follower_count')
          .eq('sns_account_id', acc.id)
          .gte('snapshot_date', `${lastMonthStr}-01`)
          .lt('snapshot_date', today)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .single();

        const current = acc.follower_count || 0;
        const prevCount = prev?.follower_count ?? null;
        const monthlyGrowthCount = prevCount !== null ? current - prevCount : null;
        const monthlyGrowthRate = prevCount && prevCount > 0
          ? Math.round(((current - prevCount) / prevCount) * 10000) / 100
          : null;
        const engagementRate = acc.avg_likes && current > 0
          ? Math.round((acc.avg_likes / current) * 10000) / 100
          : null;

        const { error: insertErr } = await sb.from('follower_snapshots').upsert({
          sns_account_id: acc.id,
          user_id: acc.user_id,
          snapshot_date: today,
          follower_count: current,
          avg_likes: acc.avg_likes,
          avg_views: acc.avg_views,
          engagement_rate: engagementRate,
          monthly_growth_count: monthlyGrowthCount,
          monthly_growth_rate: monthlyGrowthRate,
        }, { onConflict: 'sns_account_id,snapshot_date' });

        if (insertErr) { failed++; continue; }
        success++;
      } catch (e) {
        console.error(`Error for account ${acc.id}:`, e);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      message: 'Snapshot complete',
      success, failed, total: accounts.length, date: today
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Snapshot error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};

export const config = {
  schedule: '0 18 28 * *',
};
