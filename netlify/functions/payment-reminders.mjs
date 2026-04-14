import { sendEmail, templates } from './_lib/email.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://syxctolgqhdtcoaothwi.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function fetchFailures(hoursMin, hoursMax, flagColumn) {
  const now = Date.now();
  const gte = new Date(now - hoursMax * 3600 * 1000).toISOString();
  const lte = new Date(now - hoursMin * 3600 * 1000).toISOString();
  const url =
    `${SUPABASE_URL}/rest/v1/payment_failures` +
    `?select=id,email,user_id,failed_at` +
    `&resolved=eq.false` +
    `&${flagColumn}=eq.false` +
    `&failed_at=gte.${gte}` +
    `&failed_at=lte.${lte}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

async function markReminded(id, flagColumn) {
  await fetch(`${SUPABASE_URL}/rest/v1/payment_failures?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ [flagColumn]: true }),
  });
}

async function processBatch(dayLabel, flagColumn, hoursMin, hoursMax) {
  const rows = await fetchFailures(hoursMin, hoursMax, flagColumn);
  let sent = 0;
  for (const row of rows) {
    try {
      const tpl = templates.paymentFailed(dayLabel);
      await sendEmail({ to: row.email, subject: tpl.subject, html: tpl.html });
      await markReminded(row.id, flagColumn);
      sent++;
    } catch (e) {
      console.error('payment-reminders send failed', row.id, e.message);
    }
  }
  return sent;
}

export default async () => {
  if (!SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const day3 = await processBatch('3日目', 'reminded_day3', 60, 84);
    const day7 = await processBatch('7日目', 'reminded_day7', 156, 180);
    return new Response(JSON.stringify({ ok: true, day3, day7 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  schedule: '0 9 * * *',
};
