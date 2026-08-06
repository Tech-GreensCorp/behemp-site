import { env } from './lib/env';
import { SignJWT, importPKCS8 } from 'jose';
import crypto from 'crypto';

async function run() {
  try {
    const rawKey = process.env.DOCUSIGN_PRIVATE_KEY ?? '';
    const privateKeyPem = rawKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim();
    let pem = privateKeyPem;
    if (privateKeyPem.includes('BEGIN RSA PRIVATE KEY')) {
      const pk = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem', type: 'pkcs1' });
      pem = pk.export({ format: 'pem', type: 'pkcs8' }) as string;
    }
    const privateKey = await importPKCS8(pem, 'RS256');

    const oauthBase = (process.env.DOCUSIGN_OAUTH_BASE_URL ?? 'https://account-d.docusign.com').replace('https://', '');
    const agora = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({
      sub: process.env.DOCUSIGN_USER_ID!,
      iss: process.env.DOCUSIGN_INTEGRATION_KEY!,
      aud: oauthBase,
      scope: 'signature impersonation',
      iat: agora,
      exp: agora + 3600,
    }).setProtectedHeader({ alg: 'RS256' }).sign(privateKey);

    const tokenUrl = `https://${oauthBase}/oauth/token`;
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    
    if (!res.ok) {
      console.log('Token Error:', await res.text());
      return;
    }
    const data = await res.json();
    const token = data.access_token;
    
    console.log('Token obtained!');
    
    const userRes = await fetch(`https://${oauthBase}/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!userRes.ok) {
      console.log('UserInfo Error:', await userRes.text());
      return;
    }
    
    const userInfo = await userRes.json();
    console.log(JSON.stringify(userInfo, null, 2));
    
  } catch(e) {
    console.error(e);
  }
}
run();
