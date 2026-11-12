function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metode tidak diizinkan.' }, 405);
  }
  if (!env.GOOGLE_APPS_SCRIPT_URL || !env.LSA_BIMBEL_API_SECRET) {
    return jsonResponse({ error: 'Konfigurasi API Google Sheets belum lengkap.' }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Format permintaan tidak valid.' }, 400);
  }

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
      const error = isHtml
        ? `Google Apps Script mengembalikan halaman HTML (HTTP ${upstream.status}). Pastikan URL berakhiran /exec, deployment Web App memakai versi terbaru, dijalankan sebagai Anda, dan aksesnya Anyone.`
        : `Respons Google Apps Script bukan JSON (HTTP ${upstream.status}, Content-Type: ${contentType}). Pastikan URL Web App dan deployment sudah benar.`;
      return jsonResponse({ error }, 502);
    }
    return jsonResponse(responseData, upstream.ok ? 200 : 502);
  } catch (error) {
    return jsonResponse({ error: `Tidak dapat menghubungi Google Apps Script: ${error.message}` }, 502);
  }
}
