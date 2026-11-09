import { Resend } from 'resend';

// Initialize Resend client with API Key
const resendApiKey = process.env.RESEND_API_KEY || '';
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Default From address (uses Resend dev domain if custom domain is not yet configured)
const defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'Vault <onboarding@resend.dev>';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

const inr = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

async function sendMail({ to, subject, html, text, templateEnv, variables, attachments }) {
  if (!to) return { success: false, error: 'Recipient email is required.' };
  if (!resend) {
    console.warn(`[Resend] RESEND_API_KEY is not configured. Skipping email to ${to}.`);
    return { success: false, error: 'RESEND_API_KEY is not configured.' };
  }
  const templateId = templateEnv ? process.env[templateEnv] : '';
  const payload = {
    from: defaultFromEmail,
    to,
    subject,
    headers: { 'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
  };
  if (attachments?.length) payload.attachments = attachments;
  if (templateId) {
    payload.template = { id: templateId, variables: variables || {} };
  } else {
    payload.html = html;
    payload.text = text;
  }
  const data = await resend.emails.send(payload);
  return { success: true, messageId: data?.data?.id || data?.id };
}

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
  const welcomeVariables = {
    NAME: name || 'there',
    ORG_NAME: orgName || 'Workspace',
    EMAIL: to,
    DASHBOARD_URL: `${clientUrl}/`,
  };
  if (process.env.RESEND_TEMPLATE_WELCOME) {
    return sendMail({
      to,
      subject: 'Welcome to Vault',
      templateEnv: 'RESEND_TEMPLATE_WELCOME',
      variables: welcomeVariables,
      text: `Welcome to Vault, ${welcomeVariables.NAME}. Organization: ${welcomeVariables.ORG_NAME}. Open ${welcomeVariables.DASHBOARD_URL}`,
    });
  }
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
  bucketName,
  limitAmount,
  currentSpend,
  percentUsed,
  remainingAmount,
  threshold,
  periodLabel,
  status,
}) => {
  if (!to) return { success: false, error: 'Recipient email is required.' };
  const remaining = remainingAmount ?? Math.max(0, Number(limitAmount || 0) - Number(currentSpend || 0));
  const variables = {
    NAME: userName || 'there',
    COMPANY_NAME: companyName || 'Company',
    CATEGORY_NAME: categoryName || 'Category',
    BUCKET_NAME: bucketName || categoryName || 'Budget',
    LIMIT_AMOUNT: inr(limitAmount),
    CURRENT_SPEND: inr(currentSpend),
    REMAINING_AMOUNT: inr(remaining),
    PERCENT_USED: `${percentUsed}%`,
    THRESHOLD: `${threshold || 80}%`,
    PERIOD_LABEL: periodLabel || 'Current period',
    STATUS: status || (Number(percentUsed) >= 100 ? 'Over budget' : 'Threshold reached'),
    BUDGET_URL: `${clientUrl}/budgets`,
  };
  if (process.env.RESEND_TEMPLATE_BUDGET_ALERT) {
    return sendMail({
      to,
      subject: `Budget alert: ${variables.CATEGORY_NAME} is at ${variables.PERCENT_USED}`,
      templateEnv: 'RESEND_TEMPLATE_BUDGET_ALERT',
      variables,
      text: `${variables.BUCKET_NAME} at ${variables.COMPANY_NAME} is ${variables.STATUS}. Spent ${variables.CURRENT_SPEND} of ${variables.LIMIT_AMOUNT}.`,
    });
  }
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

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  if (!resend) {
    console.log(`[Resend] RESEND_API_KEY is not configured. Password reset link for ${to}: ${resetUrl}`);
    return { success: false, error: 'Email service is not configured.' };
  }
  const variables = {
    NAME: name || 'there',
    RESET_URL: resetUrl,
    EXPIRES_IN: '1 hour',
  };
  if (process.env.RESEND_TEMPLATE_PASSWORD_RESET) {
    return sendMail({
      to,
      subject: 'Reset your Vault password',
      templateEnv: 'RESEND_TEMPLATE_PASSWORD_RESET',
      variables,
      text: `Reset your Vault password: ${resetUrl}`,
    });
  }

  try {
    const html = buildVaultEmailTemplate({
      headline: 'Reset your Vault password',
      badgeText: 'Password Reset',
      greeting: `Hello ${name || 'there'},`,
      bodyHtml: `<p>A password reset was requested for this account. The link is valid for one hour.</p>`,
      ctaText: 'Reset password',
      ctaUrl: resetUrl,
      footerNote: 'If you did not request this, you can ignore the email.',
    });

    const data = await resend.emails.send({
      from: defaultFromEmail,
      to,
      subject: 'Reset your Vault password',
      html,
      text: `Reset your Vault password: ${resetUrl}`,
    });
    return { success: true, messageId: data?.data?.id || data?.id };
  } catch (err) {
    console.error(`[Resend Error] Failed to send password reset to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

export const sendInviteEmail = async ({ to, inviterName, orgName, accessSummary, joinUrl }) => {
  const variables = {
    INVITER_NAME: inviterName || 'The owner',
    ORG_NAME: orgName || 'Vault',
    ACCESS_SUMMARY: accessSummary || 'Workspace',
    JOIN_URL: joinUrl,
    EXPIRES_IN: '7 days',
  };
  const html = buildVaultEmailTemplate({
    headline: `Join ${variables.ORG_NAME} on Vault`,
    badgeText: 'Invitation',
    greeting: 'Hello,',
    bodyHtml: `<p><strong>${variables.INVITER_NAME}</strong> invited you to <strong>${variables.ORG_NAME}</strong>.</p><p>Access: ${variables.ACCESS_SUMMARY}</p><p>This link expires in ${variables.EXPIRES_IN}.</p>`,
    ctaText: 'Accept invitation',
    ctaUrl: joinUrl,
    footerNote: 'If you were not expecting this invite, you can ignore the email.',
  });
  return sendMail({
    to,
    subject: `You are invited to ${variables.ORG_NAME} on Vault`,
    html,
    text: `${variables.INVITER_NAME} invited you to ${variables.ORG_NAME}. Access: ${variables.ACCESS_SUMMARY}. Join: ${joinUrl}`,
    templateEnv: 'RESEND_TEMPLATE_INVITE',
    variables,
  });
};

export const sendReportEmail = async ({ to, kind, variables, pdf }) => {
  const templateEnv = kind === 'monthly' ? 'RESEND_TEMPLATE_MONTHLY_REPORT' : 'RESEND_TEMPLATE_WEEKLY_REPORT';
  const subject = kind === 'monthly'
    ? `Monthly Vault report · ${variables.PERIOD_LABEL}`
    : `Weekly Vault report · ${variables.PERIOD_LABEL}`;
  const html = buildVaultEmailTemplate({
    headline: subject,
    badgeText: kind === 'monthly' ? 'Monthly report' : 'Weekly report',
    greeting: `Hello ${variables.NAME},`,
    bodyHtml: `<p>The ${kind} report for <strong>${variables.ORG_NAME}</strong> covers <strong>${variables.PERIOD_LABEL}</strong>.</p>
      <p>Income ${variables.TOTAL_INCOME}. Expenses ${variables.TOTAL_EXPENSES}. Net ${variables.NET}.</p>
      <p>The full ledger is attached as <strong>${variables.ATTACHMENT_NAME}</strong>.</p>`,
    ctaText: 'Open dashboard',
    ctaUrl: variables.DASHBOARD_URL,
  });
  return sendMail({
    to,
    subject,
    html,
    text: `${subject}. Income ${variables.TOTAL_INCOME}. Expenses ${variables.TOTAL_EXPENSES}. Net ${variables.NET}. The PDF ${variables.ATTACHMENT_NAME} is attached.`,
    templateEnv,
    variables,
    attachments: pdf
      ? [{ filename: variables.ATTACHMENT_NAME, content: pdf.toString('base64') }]
      : undefined,
  });
};

export default {
  sendWelcomeEmail,
  sendBudgetAlertEmail,
  sendDisbursementAlertEmail,
  sendTestEmail,
  sendPasswordResetEmail,
  sendInviteEmail,
  sendReportEmail,
};
