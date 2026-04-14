import { sendEmail, templates } from './_lib/email.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://syxctolgqhdtcosothwi.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Required Supabase table (create once):
//   create table if not exists payment_failures (
//     id uuid primary key default gen_random_uuid(),
//     email text not null,
//     user_id uuid,
//     failed_at timestamptz not null default now(),
//     reminded_day3 boolean default false,
//     reminded_day7 boolean default false,
//     resolved boolean default false
//   );

async function recordFailure({ email, userId }) {
  if (!SERVICE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/payment_failures`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ email, user_id: userId || null }),
  }).catch(() => {});
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let event;
  try {
    event = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  try {
    const type = event.type;
    const obj = event.data?.object || {};

    if (type === 'invoice.payment_failed') {
      const email =
        obj.customer_email ||
        obj.customer_address?.email ||
        obj.receipt_email;
      if (email) {
        const tpl = templates.paymentFailed('1日目');
        await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        await recordFailure({ email, userId: obj.metadata?.user_id });
      }
    }

    if (type === 'customer.subscription.updated') {
      const prev = event.data?.previous_attributes || {};
      const prevItems = prev.items?.data?.[0]?.price;
      if (prevItems) {
        const email = obj.metadata?.email || obj.customer_email;
        const oldPlan = prevItems.nickname || prevItems.id || '';
        const newPlan =
          obj.items?.data?.[0]?.price?.nickname ||
          obj.items?.data?.[0]?.price?.id ||
          '';
        if (email) {
          const tpl = templates.planChanged(oldPlan, newPlan);
          await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
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

export const config = { path: '/api/stripe-webhook' };
