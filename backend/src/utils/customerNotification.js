function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export async function sendCustomerNotification({ to, subject, heading, greetingName, message, details = [], actionLabel = '', actionUrl = '' }) {
  if (!to) return { status: 'no_email', error: 'Customer has no email address.' };
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) return { status: 'not_configured', error: 'Customer email notifications are not configured.' };
  const rows = details.map(([label, value]) => '<tr><td style="padding:9px 12px;color:#687782;border-bottom:1px solid #e8edf0">' + escapeHtml(label) + '</td><td style="padding:9px 12px;font-weight:600;border-bottom:1px solid #e8edf0">' + escapeHtml(value) + '</td></tr>').join('');
  const safeHeading = escapeHtml(heading);
  const safeMessage = escapeHtml(message);
  const safeName = escapeHtml(greetingName || 'Customer');
  const safeUrl = escapeHtml(actionUrl);
  const html = '<!doctype html><html><body style="margin:0;padding:28px;background:#f2f5f6;font-family:Arial,sans-serif;color:#193247"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e4e9ec"><header style="padding:24px 30px;background:#091c2c;color:#fff;border-bottom:5px solid #f28a35"><b style="font-size:20px">BRIDGEWAY LOGISTICS</b><p style="font-size:11px;color:#c6d1d8">CUSTOMER NOTIFICATION</p></header><main style="padding:30px"><h2>' + safeHeading + '</h2><p>Dear ' + safeName + ',</p><p style="line-height:1.7">' + safeMessage + '</p>' + (rows ? '<table style="width:100%;border-collapse:collapse;background:#f7f9fa">' + rows + '</table>' : '') + (actionUrl ? '<p style="margin:28px 0"><a href="' + safeUrl + '" style="display:inline-block;padding:14px 20px;background:#f28a35;color:#10283b;text-decoration:none;font-weight:bold">' + escapeHtml(actionLabel || 'View details') + '</a></p>' : '') + '<p>Kind regards,<br><b>Bridgeway Logistics</b></p></main></div></body></html>';
  const text = ['Dear ' + (greetingName || 'Customer') + ',', '', heading, message, ...details.map(([label, value]) => label + ': ' + value), actionUrl ? (actionLabel || 'View details') + ': ' + actionUrl : '', '', 'Kind regards, Bridgeway Logistics'].filter(Boolean).join('\n');
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.FROM_EMAIL, to: [to], subject, text, html }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { status: 'failed', error: String(result.message || 'Email provider rejected the request.').slice(0, 500) };
    return { status: 'sent', error: '', messageId: result.id || '' };
  } catch (error) {
    return { status: 'failed', error: String(error.message || 'Email delivery failed.').slice(0, 500) };
  }
}
