import jwt from 'jsonwebtoken';

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certCache = { certs: null, expiresAt: 0 };

const loadCerts = async () => {
  if (certCache.certs && Date.now() < certCache.expiresAt) {
    return certCache.certs;
  }

  const response = await fetch(CERT_URL);
  if (!response.ok) {
    throw new Error('Unable to load Firebase signing keys.');
  }

  const certs = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
  certCache = { certs, expiresAt: Date.now() + maxAgeMs };
  return certs;
};

export const verifyFirebaseIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('A Firebase sign-in token is required.');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'vault-cbf53';
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid) {
    throw new Error('Invalid Firebase sign-in token.');
  }

  const certs = await loadCerts();
  const certificate = certs[kid];
  if (!certificate) {
    throw new Error('Firebase sign-in token was signed by an unknown key.');
  }

  const payload = jwt.verify(idToken, certificate, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  });

  if (!payload?.email) {
    throw new Error('The Google account has no email address.');
  }

  return {
    email: String(payload.email).toLowerCase().trim(),
    uid: payload.sub || payload.user_id || null,
    name: payload.name || null,
    picture: payload.picture || null,
  };
};
