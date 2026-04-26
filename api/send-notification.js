const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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



  
  const action = req.query.action;

  // 🔔 subscribe
  if (action === 'subscribe') {
    const sub = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!sub || !sub.endpoint) {
      return res.status(400).json({ ok: false });
    }

    const key = 'sub:' + sub.endpoint;
    await redis(['SET', key, JSON.stringify(sub)]);

    return res.json({ ok: true });
  }

  // 🚀 send
  if (action === 'send') {
    const payload = JSON.stringify(req.body || {
      title: 'TEST',
      body: 'TEST'
    });

    const keys = await redis(['KEYS', 'sub:*']) || [];

    let success = 0;
    let failed = 0;

    for (const key of keys) {
      const raw = await redis(['GET', key]);
      if (!raw) continue;

      const sub = JSON.parse(raw);

      try {
        await webpush.sendNotification(sub, payload);
        success++;
      } catch (e) {
        failed++;
        await redis(['DEL', key]); // ลบทิ้งถ้าพัง
      }
    }

    return res.json({
      success,
      failed,
      total: keys.length
    });
  }

  res.json({ ok: true });
};
