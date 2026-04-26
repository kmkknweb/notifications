const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL
                 || process.env.KV_REST_API_URL
                 || process.env.REDIS_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
                 || process.env.KV_REST_API_TOKEN;

async function redis(cmd) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cmd)
  });
  const data = await res.json();
  return data.result;
}

module.exports = async (req, res) => {
  // ── CORS ────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const action = req.query.action;

  // ── subscribe ────────────────────────────────────────────
  if (action === 'subscribe') {
    const sub = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!sub || !sub.endpoint) {
      return res.status(400).json({ ok: false, error: 'missing endpoint' });
    }

    const key = 'sub:' + Buffer.from(sub.endpoint).toString('base64').slice(-20);
    await redis(['SET', key, JSON.stringify(sub)]);

    return res.status(201).json({ ok: true });
  }

  // ── send ─────────────────────────────────────────────────
  if (action === 'send') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payload = JSON.stringify({
      title: body.title || 'แจ้งเตือน',
      body:  body.body  || '',
      url:   body.url   || '/'
    });

    const keys = await redis(['KEYS', 'sub:*']) || [];

    const results = await Promise.allSettled(
      keys.map(async key => {
        const raw = await redis(['GET', key]);
        if (!raw) return;
        const sub = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return webpush.sendNotification(sub, payload).catch(async err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await redis(['DEL', key]); // subscription หมดอายุ ลบทิ้ง
          }
          throw err;
        });
      })
    );

    return res.json({
      sent:   results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      total:  keys.length
    });
  }

  // ── health check ─────────────────────────────────────────
  res.json({ ok: true, status: 'ready' });
};
