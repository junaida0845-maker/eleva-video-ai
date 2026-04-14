const FROM = 'ELEVA <noreply@letiziainc.com>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }
  if (!to || !subject || !html) {
    throw new Error('sendEmail requires to, subject, html');
  }

  const payload = {
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend error ${res.status}: ${errText}`);
  }
  return res.json();
}

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:24px;font-weight:700;letter-spacing:2px;color:#111;">ELEVA</div>
    </div>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;">
    <p style="font-size:12px;color:#888;text-align:center;margin:0;">
      © Letizia Inc. &nbsp;|&nbsp; <a href="https://eleva.letizia-inc.com" style="color:#888;">eleva.letizia-inc.com</a>
    </p>
  </div>
</body>
</html>`;
}

export const templates = {
  welcome(name = '') {
    const greeting = name ? `${name} さん` : 'こんにちは';
    return {
      subject: 'ELEVAへようこそ',
      html: layout('Welcome', `
        <h1 style="font-size:22px;margin:0 0 16px;">${greeting}、ELEVAへようこそ 🎬</h1>
        <p style="font-size:15px;line-height:1.7;color:#333;">
          ご登録ありがとうございます。ELEVAはAIで縦型ショート動画を自動生成するツールです。
          今すぐダッシュボードにアクセスして、最初の動画を作ってみましょう。
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://eleva.letizia-inc.com/dashboard.html"
             style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:600;">
            ダッシュボードへ
          </a>
        </div>
        <p style="font-size:13px;color:#666;line-height:1.6;">
          ご不明点があれば、このメールに返信してください。
        </p>
      `),
    };
  },

  paymentFailed(dayLabel = '1日目') {
    return {
      subject: `【重要】お支払いに失敗しました（${dayLabel}）`,
      html: layout('Payment Failed', `
        <h1 style="font-size:22px;margin:0 0 16px;color:#c0392b;">お支払いの確認が必要です</h1>
        <p style="font-size:15px;line-height:1.7;color:#333;">
          ELEVAの定期購読の決済に失敗しました（${dayLabel}）。
          サービスを継続してご利用いただくため、お支払い方法をご確認ください。
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://eleva.letizia-inc.com/settings.html"
             style="display:inline-block;background:#c0392b;color:#fff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:600;">
            お支払い方法を更新
          </a>
        </div>
        <p style="font-size:13px;color:#666;line-height:1.6;">
          7日以内に解決されない場合、アカウントは自動的に停止されます。
        </p>
      `),
    };
  },

  planChanged(oldPlan, newPlan) {
    return {
      subject: 'プラン変更が完了しました',
      html: layout('Plan Updated', `
        <h1 style="font-size:22px;margin:0 0 16px;">プランを更新しました</h1>
        <p style="font-size:15px;line-height:1.7;color:#333;">
          プラン変更が正常に完了しました。
        </p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr>
            <td style="padding:12px;background:#f6f7f9;border-radius:8px 0 0 8px;font-size:13px;color:#666;">変更前</td>
            <td style="padding:12px;background:#f6f7f9;border-radius:0 8px 8px 0;font-size:15px;font-weight:600;">${oldPlan || '-'}</td>
          </tr>
          <tr><td colspan="2" style="height:8px;"></td></tr>
          <tr>
            <td style="padding:12px;background:#e8f5e9;border-radius:8px 0 0 8px;font-size:13px;color:#2e7d32;">変更後</td>
            <td style="padding:12px;background:#e8f5e9;border-radius:0 8px 8px 0;font-size:15px;font-weight:600;color:#2e7d32;">${newPlan || '-'}</td>
          </tr>
        </table>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://eleva.letizia-inc.com/settings.html"
             style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:600;">
            プラン詳細を見る
          </a>
        </div>
      `),
    };
  },
};
