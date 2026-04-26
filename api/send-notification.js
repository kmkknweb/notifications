const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const REDIS_URL   = process.env.MY_REDIS_URL;
const REDIS_TOKEN = process.env.MY_REDIS_TOKEN;

async function redis(cmd) {
  console.log('Redis CMD:', JSON.stringify(cmd));
  console.log('Redis URL:', REDIS_URL || 'NOT SET');

  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error('Redis env not set: MY_REDIS_URL or MY_REDIS_TOKEN missing');
  }

  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cmd)
  });

  const text = await res.text();
  console.log('Redis response status:', res.status);
  console.log('Redis response body:', text);

  const data = JSON.parse(text);
  return data.result;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const action = req.query.action;

  // subscribe
  if (action === 'subscribe') {
    try {
      const sub = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!sub || !sub.endpoint) {
        return res.status(400).json({ ok: false, error: 'missing endpoint' });
      }
      console.log('Subscribing endpoint:', sub.endpoint.slice(0, 50));
      const key = 'sub:' + Buffer.from(sub.endpoint).toString('base64').slice(-20);
      console.log('Redis key:', key);
      await redis(['SET', key, JSON.stringify(sub)]);
      console.log('Subscribe success');
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error('Subscribe error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // send
  if (action === 'send') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const payload = JSON.stringify({
        title: body.title || 'แจ้งเตือน',
        body:  body.body  || '',
        url:   body.url   || '/'
      });
      const keys = await redis(['KEYS', 'sub:*']) || [];
      console.log('Found keys:', keys.length);
      const results = await Promise.allSettled(
        keys.map(async key => {
          const raw = await redis(['GET', key]);
          if (!raw) return;
          const sub = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return webpush.sendNotification(sub, payload).catch(async err => {
            console.error('Push error:', err.statusCode, err.message);
            if (err.statusCode === 410 || err.statusCode === 404) {
              await redis(['DEL', key]);
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
    } catch (err) {
      console.error('Send error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  res.json({ ok: true, status: 'ready' });
};
