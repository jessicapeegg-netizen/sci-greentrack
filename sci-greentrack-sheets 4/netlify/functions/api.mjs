export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  const gasUrl = process.env.GAS_WEB_APP_URL;
  const sharedSecret = process.env.GAS_SHARED_SECRET;
  if (!gasUrl || !sharedSecret) {
    return Response.json({ ok: false, error: 'ยังไม่ได้ตั้งค่า GAS_WEB_APP_URL / GAS_SHARED_SECRET ใน Netlify' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const upstream = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        action: body.action,
        token: body.token || '',
        payload: body.payload || {},
        sharedSecret
      })
    });

    const text = await upstream.text();
    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error('Apps Script ไม่ได้ตอบกลับเป็น JSON: ' + text.slice(0, 180)); }

    return Response.json(json, {
      status: json.ok === false ? 400 : 200,
      headers: { 'cache-control': 'no-store' }
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || String(error) }, { status: 500 });
  }
};
