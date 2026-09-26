import https from 'node:https';
import http from 'node:http';

let keepAliveInterval = null;

/**
 * Self-pinging keep-alive service for Render / cloud free tiers.
 * Pings the /health endpoint every 10 minutes to prevent cold starts & sleep mode.
 */
export const initKeepAlive = () => {
  const targetUrl = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL || process.env.SERVER_URL;
  const isEnabled = process.env.KEEP_ALIVE === 'true' || Boolean(targetUrl);

  if (!isEnabled || !targetUrl) {
    return;
  }

  const pingUrl = targetUrl.endsWith('/health') ? targetUrl : `${targetUrl.replace(/\/+$/, '')}/health`;
  const intervalMinutes = Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES) || 10;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[KeepAlive] Service active. Pinging ${pingUrl} every ${intervalMinutes} minutes.`);

  if (keepAliveInterval) clearInterval(keepAliveInterval);

  keepAliveInterval = setInterval(() => {
    const client = pingUrl.startsWith('https') ? https : http;
    const req = client.get(pingUrl, (res) => {
      console.log(`[KeepAlive Ping] ${new Date().toISOString()} -> Status: ${res.statusCode}`);
    });

    req.on('error', (err) => {
      console.warn(`[KeepAlive Error] ${new Date().toISOString()} -> ${err.message}`);
    });
  }, intervalMs);
};

export const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
};

export default { initKeepAlive, stopKeepAlive };
