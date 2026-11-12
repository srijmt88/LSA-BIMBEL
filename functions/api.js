const SESSION_COOKIE_NAME = 'lsa_admin_session';
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    }
  });
}

function hasAuthenticationConfig(env) {
  return Boolean(
    env.ADMIN_USERNAME &&
    env.ADMIN_PASSWORD &&
    env.ADMIN_PASSWORD.length >= 16 &&
    env.AUTH_SESSION_SECRET &&
    env.AUTH_SESSION_SECRET.length >= 32
  );
}

function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index++) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function getHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

async function createSessionToken(username, secret, role, tutorId) {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
    username,
    role,
    ...(role === 'tutor' ? { tutorId } : {}),
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000
  })));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await getHmacKey(secret, ['sign']),
    new TextEncoder().encode(payload)
  );
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

function getCookie(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  const cookie = cookies.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : '';
}

function getTutorAccounts(env) {
  if (!env.TUTOR_ACCOUNTS) return [];
  let accounts;
  try {
    accounts = JSON.parse(env.TUTOR_ACCOUNTS);
  } catch {
    throw new Error('TUTOR_ACCOUNTS harus berisi JSON array yang valid.');
  }
  if (!Array.isArray(accounts) || accounts.length > 100) {
    throw new Error('TUTOR_ACCOUNTS harus berupa array dengan maksimal 100 akun.');
  }

  const usernames = new Set();
  return accounts.map(account => {
    if (!account || typeof account !== 'object' || Array.isArray(account) ||
        typeof account.username !== 'string' || !account.username.trim() ||
        account.username.length > 256 || typeof account.password !== 'string' ||
        account.password.length < 16 || account.password.length > 1024 ||
        !Number.isSafeInteger(account.tutorId) || account.tutorId <= 0 ||
        usernames.has(account.username) || account.username === env.ADMIN_USERNAME) {
      throw new Error('Setiap akun TUTOR_ACCOUNTS harus memiliki username unik, password minimal 16 karakter, dan tutorId positif.');
    }
    usernames.add(account.username);
    return {
      username: account.username,
      password: account.password,
      tutorId: account.tutorId
    };
  });
}

async function getAuthenticatedSession(request, env) {
  if (!hasAuthenticationConfig(env)) return null;
  const token = getCookie(request, SESSION_COOKIE_NAME);
  const separator = token.indexOf('.');
  if (separator <= 0 || separator === token.length - 1) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getHmacKey(env.AUTH_SESSION_SECRET, ['verify']),
      decodeBase64Url(signature),
      new TextEncoder().encode(payload)
    );
    if (!valid) return null;

    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    if (typeof session.username !== 'string' || session.expiresAt <= Date.now()) return null;

    const role = session.role || (session.username === env.ADMIN_USERNAME ? 'owner' : '');
    if (role === 'owner' && session.username === env.ADMIN_USERNAME) {
      return { username: session.username, role: 'owner' };
    }
    if (role === 'tutor' && Number.isSafeInteger(session.tutorId) && session.tutorId > 0) {
      const account = getTutorAccounts(env).find(item =>
        item.username === session.username && item.tutorId === session.tutorId
      );
      if (account) {
        return { username: session.username, role: 'tutor', tutorId: account.tutorId };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function sessionCookie(value, maxAge) {
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function forwardToAppsScript(payload, env) {
  try {
    const upstream = await fetch(env.GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, secret: env.LSA_BIMBEL_API_SECRET })
    });
    const responseText = await upstream.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      const contentType = upstream.headers.get('content-type') || 'tidak diketahui';
      const isHtml = contentType.includes('text/html') || /^\s*</.test(responseText);
      const error = upstream.status === 401
        ? 'Google Apps Script menolak akses (HTTP 401). Otorisasikan setupDatabase() dari editor Apps Script dan setujui izin Google Sheets. Pastikan juga Web App dijalankan sebagai Anda dengan akses Anyone; kebijakan Google Workspace dapat membatasi akses publik.'
        : isHtml
          ? `Google Apps Script mengembalikan halaman HTML (HTTP ${upstream.status}). Pastikan URL berakhiran /exec dan deployment Web App memakai versi terbaru, dijalankan sebagai Anda, dengan akses Anyone.`
          : `Respons Google Apps Script bukan JSON (HTTP ${upstream.status}, Content-Type: ${contentType}). Periksa URL dan deployment Web App.`;
      return jsonResponse({ error }, 502);
    }
    if (responseData && responseData.error === 'Aksi API tidak dikenal.' &&
        ['getTutorPortalData', 'saveTutorJournal'].includes(payload.action)) {
      return jsonResponse({
        error: 'Google Apps Script yang terhubung belum mendukung portal tentor. Perbarui Code.gs, lalu buka Deploy → Manage deployments → Edit, pilih New version, dan Deploy. Jika membuat deployment baru, perbarui GOOGLE_APPS_SCRIPT_URL di Cloudflare.'
      }, 502);
    }
    return jsonResponse(responseData, upstream.ok ? 200 : 502);
  } catch (error) {
    return jsonResponse({ error: `Tidak dapat menghubungi Google Apps Script: ${error.message}` }, 502);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metode tidak diizinkan.' }, 405);
  }
  if (!isSameOrigin(request)) {
    return jsonResponse({ error: 'Asal permintaan tidak diizinkan.' }, 403);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Format permintaan tidak valid.' }, 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonResponse({ error: 'Format permintaan tidak valid.' }, 400);
  }

  if (payload.action === 'login') {
    if (!hasAuthenticationConfig(env)) {
      return jsonResponse({ error: 'Login belum dikonfigurasi di Cloudflare.' }, 500);
    }
    const username = typeof payload.username === 'string' ? payload.username : '';
    const password = typeof payload.password === 'string' ? payload.password : '';
    if (username.length > 256 || password.length > 1024) {
      return jsonResponse({ error: 'Username atau password salah.' }, 401);
    }

    let role = '';
    let tutorId;
    if (constantTimeEqual(username, env.ADMIN_USERNAME) &&
        constantTimeEqual(password, env.ADMIN_PASSWORD)) {
      role = 'owner';
    } else {
      let tutorAccounts;
      try {
        tutorAccounts = getTutorAccounts(env);
      } catch (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      const account = tutorAccounts.find(item => item.username === username);
      if (!account || !constantTimeEqual(password, account.password)) {
        return jsonResponse({ error: 'Username atau password salah.' }, 401);
      }
      role = 'tutor';
      tutorId = account.tutorId;
    }

    const token = await createSessionToken(username, env.AUTH_SESSION_SECRET, role, tutorId);
    return jsonResponse(
      { authenticated: true, role, ...(role === 'tutor' ? { tutorId } : {}) },
      200,
      { 'Set-Cookie': sessionCookie(token, SESSION_DURATION_SECONDS) }
    );
  }

  if (payload.action === 'logout') {
    return jsonResponse(
      { authenticated: false },
      200,
      { 'Set-Cookie': sessionCookie('', 0) }
    );
  }

  if (payload.action === 'checkSession') {
    if (!hasAuthenticationConfig(env)) {
      return jsonResponse({ error: 'Login belum dikonfigurasi di Cloudflare.' }, 500);
    }
    const session = await getAuthenticatedSession(request, env);
    if (!session) {
      return jsonResponse({ error: 'Silakan login kembali.' }, 401);
    }
    return jsonResponse({
      authenticated: true,
      username: session.username,
      role: session.role,
      ...(session.role === 'tutor' ? { tutorId: session.tutorId } : {})
    });
  }

  if (['getAttendanceOptions', 'recordAttendance'].includes(payload.action)) {
    if (!env.GOOGLE_APPS_SCRIPT_URL || !env.LSA_BIMBEL_API_SECRET) {
      return jsonResponse({ error: 'Konfigurasi API Google Sheets belum lengkap.' }, 500);
    }
    if (typeof payload.token !== 'string' || !/^[a-f0-9]{48}$/.test(payload.token)) {
      return jsonResponse({ error: 'Token presensi tidak valid.' }, 400);
    }
    if (payload.action === 'recordAttendance' &&
        (!['tutor', 'student'].includes(payload.participantType) ||
         !Number.isSafeInteger(payload.participantId) || payload.participantId <= 0 ||
         !['checkIn', 'checkOut'].includes(payload.attendanceAction))) {
      return jsonResponse({ error: 'Data presensi tidak valid.' }, 400);
    }
    return forwardToAppsScript(payload, env);
  }

  const session = await getAuthenticatedSession(request, env);
  if (!session) {
    return jsonResponse({ error: 'Sesi tidak ditemukan atau telah berakhir.' }, 401);
  }
  if (!env.GOOGLE_APPS_SCRIPT_URL || !env.LSA_BIMBEL_API_SECRET) {
    return jsonResponse({ error: 'Konfigurasi API Google Sheets belum lengkap.' }, 500);
  }
  if (session.role === 'tutor') {
    if (payload.action === 'getTutorPortalData') {
      return forwardToAppsScript({
        action: 'getTutorPortalData',
        tutorId: session.tutorId
      }, env);
    }
    if (payload.action === 'saveTutorJournal') {
      if (!Number.isSafeInteger(payload.scheduleId) || payload.scheduleId <= 0 ||
          typeof payload.material !== 'string' ||
          !Array.isArray(payload.evaluations) || payload.evaluations.length < 1 ||
          payload.evaluations.length > 50) {
        return jsonResponse({ error: 'Data jurnal tidak valid.' }, 400);
      }
      return forwardToAppsScript({
        ...payload,
        action: 'saveTutorJournal',
        tutorId: session.tutorId
      }, env);
    }
    return jsonResponse({ error: 'Akses tentor tidak diizinkan untuk aksi ini.' }, 403);
  }

  if (!['getDatabase', 'saveDatabase'].includes(payload.action)) {
    return jsonResponse({ error: 'Aksi API tidak dikenal.' }, 400);
  }

  return forwardToAppsScript(payload, env);
}
