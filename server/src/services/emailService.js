import { Resend } from 'resend';

// Initialize Resend client with API Key
const resendApiKey = process.env.RESEND_API_KEY || '';
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Default From address (uses Resend dev domain if custom domain is not yet configured)
const defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'Vault <onboarding@resend.dev>';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * Standard Vault Branded HTML Email Template Wrapper
 */
const buildVaultEmailTemplate = ({
  headline,
  badgeText = 'Vault Notification',
  badgeColor = '#10b981',
  greeting,
  bodyHtml,
  ctaText = 'Open Vault Dashboard',
  ctaUrl = clientUrl,
  footerNote = 'You received this notification because your account is active in Vault.',
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0c0d0e;
      color: #ededed;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #0c0d0e;
      padding: 30px 15px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #141517;
      border: 1px solid #26282b;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .header {
      padding: 24px 30px;
      background: #1a1c1e;
      border-bottom: 1px solid #26282b;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      text-decoration: none;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: rgba(16, 185, 129, 0.15);
      color: ${badgeColor};
      border: 1px solid ${badgeColor};
    }
    .content {
      padding: 30px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 16px 0;
      letter-spacing: -0.3px;
    }
    p {
      margin: 0 0 18px 0;
      color: #a1a1aa;
      font-size: 15px;
    }
    .metrics-box {
      background: #1d1f22;
      border: 1px solid #2e3136;
      border-radius: 8px;
      padding: 18px;
      margin: 20px 0;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: #ffffff;
      color: #000000;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      border-radius: 6px;
      margin-top: 10px;
    }
    .footer {
      padding: 20px 30px;
      background: #111214;
      border-top: 1px solid #222427;
      text-align: center;
      font-size: 12px;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <a href="${clientUrl}" class="brand">⚡ VAULT</a>
        <span class="badge">${badgeText}</span>
      </div>
      <div class="content">
        ${greeting ? `<p style="font-weight: 600; color: #ffffff; font-size: 16px;">${greeting}</p>` : ''}
        <h1>${headline}</h1>
        ${bodyHtml}
        ${ctaText ? `<div style="margin-top: 25px;"><a href="${ctaUrl}" class="btn">${ctaText} &rarr;</a></div>` : ''}
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">Vault Financial Intelligence &bull; Multi-Entity SaaS Platform</p>
        <p style="margin: 0;">${footerNote}</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Send Welcome Email to newly registered customer (Email/Password or Firebase OAuth)
 */
export const sendWelcomeEmail = async ({ to, name, orgName }) => {
  if (!to) return { success: false, error: 'Recipient email is required.' };
  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY is not configured. Skipping welcome email.');
    return { success: false, error: 'RESEND_API_KEY is not configured.' };
  }

  try {
    const html = buildVaultEmailTemplate({
      headline: 'Welcome to Vault Financial Platform',
      badgeText: 'Account Activated',
      badgeColor: '#10b981',
      greeting: `Hello ${name || 'there'},`,
      bodyHtml: `
        <p>Your Vault organization <strong>${orgName || 'Workspace'}</strong> has been created and is ready to operate.</p>
        <p>Vault provides real-time multi-company disbursement tracking, live budget caps, revenue linkage, and AI-powered financial intelligence.</p>
        <div class="metrics-box">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #a1a1aa; padding: 4px 0;">Primary Account:</td>
              <td style="color: #ffffff; text-align: right; font-weight: 600;">${to}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 4px 0;">Organization:</td>
              <td style="color: #ffffff; text-align: right; font-weight: 600;">${orgName || 'Workspace'}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 4px 0;">Security:</td>
              <td style="color: #10b981; text-align: right; font-weight: 600;">Active &bull; 256-bit Encrypted</td>
            </tr>
          </table>
        </div>
        <p>Click below to open your unified financial workspace.</p>
      `,
      ctaText: 'Access Your Dashboard',
      ctaUrl: `${clientUrl}/`,
    });

    const text = `
Welcome to Vault, ${name || 'User'}!

Your Vault organization "${orgName || 'Workspace'}" has been created and is ready to operate.
Account: ${to}
Organization: ${orgName || 'Workspace'}
Security: 256-bit Encrypted

Access your unified dashboard at: ${clientUrl}/

Vault Financial Intelligence • Multi-Entity SaaS Platform
    `.trim();

    const data = await resend.emails.send({
      from: defaultFromEmail,
      to,
      subject: `Welcome to Vault - Account Activated (${orgName || 'Workspace'})`,
      html,
      text,
      headers: {
        'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
    });

    console.log(`[Resend] Welcome email sent to ${to} (ID: ${data?.data?.id || data?.id})`);
    return { success: true, messageId: data?.data?.id || data?.id };
  } catch (err) {
    console.error(`[Resend Error] Failed to send welcome email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send Budget Limit Alert Email when an expense causes a budget cap to be exceeded or approached
 */
export const sendBudgetAlertEmail = async ({
  to,
  userName,
  companyName,
  categoryName,
  limitAmount,
  currentSpend,
  percentUsed,
}) => {
  if (!to) return { success: false, error: 'Recipient email is required.' };
  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY is not configured. Skipping budget alert email.');
    return { success: false, error: 'RESEND_API_KEY is not configured.' };
  }

  const isOver = percentUsed >= 100;
  const badgeColor = isOver ? '#ef4444' : '#f59e0b';
  const badgeText = isOver ? 'Budget Exceeded Alert' : 'Budget Warning Alert';

  try {
    const html = buildVaultEmailTemplate({
      headline: isOver
        ? `⚠️ Over-Budget Alert: ${categoryName}`
        : `⚡ Budget Approaching Limit: ${categoryName}`,
      badgeText,
      badgeColor,
      greeting: `Hello ${userName || 'Team'},`,
      bodyHtml: `
        <p>A recent operational expense has placed your <strong>${categoryName}</strong> budget bucket in <strong>${companyName}</strong> ${
          isOver ? 'over its configured limit' : 'at a high utilization threshold'
        }.</p>
        <div class="metrics-box">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #a1a1aa; padding: 6px 0;">Entity:</td>
              <td style="color: #ffffff; text-align: right; font-weight: 600;">${companyName}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 6px 0;">Category Bucket:</td>
              <td style="color: #ffffff; text-align: right; font-weight: 600;">${categoryName}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 6px 0;">Budget Cap:</td>
              <td style="color: #ffffff; text-align: right; font-weight: 700;">₹${Number(limitAmount).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 6px 0;">Current Outlay:</td>
              <td style="color: ${badgeColor}; text-align: right; font-weight: 800;">₹${Number(currentSpend).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 6px 0;">Utilization:</td>
              <td style="color: ${badgeColor}; text-align: right; font-weight: 800;">${percentUsed}%</td>
            </tr>
          </table>
        </div>
        <p>Review this category's line-item disbursements in the ledgers to prevent unauthorized overrun.</p>
      `,
      ctaText: 'Review Budget in Vault',
      ctaUrl: `${clientUrl}/budgets`,
    });

    const text = `
Vault Budget Alert: ${categoryName}

A recent operational expense in ${companyName} has placed the ${categoryName} budget bucket at high utilization.
Entity: ${companyName}
Category: ${categoryName}
Budget Cap: ₹${Number(limitAmount).toLocaleString('en-IN')}
Current Outlay: ₹${Number(currentSpend).toLocaleString('en-IN')}
Utilization: ${percentUsed}%

Review budget details at: ${clientUrl}/budgets

Vault Financial Intelligence • Multi-Entity SaaS Platform
    `.trim();

    const data = await resend.emails.send({
      from: defaultFromEmail,
      to,
      subject: `Vault Budget Alert: ${categoryName} in ${companyName} reached ${percentUsed}% limit`,
      html,
      text,
      headers: {
        'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
    });

    console.log(`[Resend] Budget alert sent to ${to} (ID: ${data?.data?.id || data?.id})`);
    return { success: true, messageId: data?.data?.id || data?.id };
  } catch (err) {
    console.error(`[Resend Error] Failed to send budget alert to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send High-Value Disbursement Notice Email
 */
export const sendDisbursementAlertEmail = async ({
  to,
  userName,
  companyName,
  amount,
  vendor,
  categoryName,
  date,
}) => {
  if (!to) return { success: false, error: 'Recipient email is required.' };
  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY is not configured. Skipping disbursement alert email.');
    return { success: false, error: 'RESEND_API_KEY is not configured.' };
  }

  try {
    const html = buildVaultEmailTemplate({
      headline: `Disbursement Recorded: ₹${Number(amount).toLocaleString('en-IN')}`,
      badgeText: 'Disbursement Notice',
      badgeColor: '#3b82f6',
      greeting: `Hello ${userName || 'Team'},`,
      bodyHtml: `
        <p>A new expense disbursement has been recorded in the ledgers for <strong>${companyName}</strong>.</p>
        <div class="metrics-box">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #a1a1aa; padding: 5px 0;">Amount:</td>
              <td style="color: #ffffff; text-align: right; font-weight: 800; font-size: 16px;">₹${Number(amount).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 5px 0;">Payee / Vendor:</td>
              <td style="color: #ffffff; text-align: right; font-weight: 600;">${vendor || 'Unspecified'}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 5px 0;">Category:</td>
              <td style="color: #ffffff; text-align: right; font-weight: 600;">${categoryName}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 5px 0;">Date:</td>
              <td style="color: #ffffff; text-align: right;">${date || new Date().toISOString().split('T')[0]}</td>
            </tr>
          </table>
        </div>
      `,
      ctaText: 'View Expenses Ledger',
      ctaUrl: `${clientUrl}/expenses`,
    });

    const text = `
Vault Transaction Notice: ₹${Number(amount).toLocaleString('en-IN')}

A new expense disbursement has been recorded for ${companyName}.
Amount: ₹${Number(amount).toLocaleString('en-IN')}
Payee / Vendor: ${vendor || 'Unspecified'}
Category: ${categoryName}
Date: ${date || new Date().toISOString().split('T')[0]}

Review transactions at: ${clientUrl}/expenses

Vault Financial Intelligence • Multi-Entity SaaS Platform
    `.trim();

    const data = await resend.emails.send({
      from: defaultFromEmail,
      to,
      subject: `Vault Disbursement Notice: ₹${Number(amount).toLocaleString('en-IN')} to ${vendor || 'Vendor'}`,
      html,
      text,
      headers: {
        'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
    });

    return { success: true, messageId: data?.data?.id || data?.id };
  } catch (err) {
    console.error(`[Resend Error] Failed to send disbursement alert to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send Instant Test Email via Resend to verify customer communication
 */
export const sendTestEmail = async ({ to, userName }) => {
  if (!to) return { success: false, error: 'Recipient email is required.' };
  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY is not configured. Cannot send test email.');
    return { success: false, error: 'RESEND_API_KEY is not configured.' };
  }

  try {
    const html = buildVaultEmailTemplate({
      headline: 'Vault Notification System Verified',
      badgeText: 'Alert Verified',
      badgeColor: '#10b981',
      greeting: `Hello ${userName || 'Customer'},`,
      bodyHtml: `
        <p>This is a notification confirming that your <strong>Vault Financial Platform</strong> email communications are operational.</p>
        <p>Customer communications, budget alerts, and disbursement notices are connected and ready to deliver.</p>
        <div class="metrics-box">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #a1a1aa; padding: 4px 0;">Status:</td>
              <td style="color: #10b981; text-align: right; font-weight: 700;">Active &bull; Operational</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 4px 0;">Delivered To:</td>
              <td style="color: #ffffff; text-align: right; font-weight: 600;">${to}</td>
            </tr>
            <tr>
              <td style="color: #a1a1aa; padding: 4px 0;">Timestamp:</td>
              <td style="color: #ffffff; text-align: right;">${new Date().toLocaleString()}</td>
            </tr>
          </table>
        </div>
      `,
      ctaText: 'Return to Vault',
      ctaUrl: `${clientUrl}/settings`,
    });

    const text = `
Vault Notification System Verification

This is a test notification confirming that email alerts from your Vault account are configured and operational.
Recipient: ${to}
Timestamp: ${new Date().toLocaleString()}

Return to Vault: ${clientUrl}/settings

Vault Financial Intelligence • Multi-Entity SaaS Platform
    `.trim();

    const data = await resend.emails.send({
      from: defaultFromEmail,
      to,
      subject: `Vault Notification System Verification`,
      html,
      text,
      headers: {
        'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
    });

    console.log(`[Resend] Test email sent successfully to ${to} (ID: ${data?.data?.id || data?.id})`);
    return { success: true, messageId: data?.data?.id || data?.id };
  } catch (err) {
    console.error(`[Resend Error] Failed to send test email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

export default {
  sendWelcomeEmail,
  sendBudgetAlertEmail,
  sendDisbursementAlertEmail,
  sendTestEmail,
};
