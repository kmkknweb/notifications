const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redisCmd(args) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  return data.result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  if (action === 'subscribe' && req.method === 'POST') {
    const subscription = req.body;const key = 'sub:' + Buffer.from(subscription.endpoint).toString('base64').slice(-20);
    await redisCmd(['SET', key, JSON.stringify(subscription)]);
    return res.status(201).json({ message: 'Subscribed!' });
  }

  if (action === 'send' && req.method === 'POST') {
    const { title, body } = req.body;
    const payload = JSON.stringify({ title, body });

    const keys = await redisCmd(['KEYS', 'sub:*']);
    if (!keys || keys.length === 0) {
      return res.status(200).json({ sent: 0, failed: 0 });
    }

    const values = await Promise.all(keys.map(k => redisCmd(['GET', k])));
    const subscriptions = values.filter(Boolean).map(v =>
      typeof v === 'string' ? JSON.parse(v) : v
    );

    const results = await Promise.allSettled(
      subscriptions.map((sub, i) =>
        webpush.sendNotification(sub, payload).catch(async err => {
          if (err.statusCode === 410) await redisCmd(['DEL', keys[i]]);
          throw err;
        })
      )
    );

    return res.status(200).json({
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    });
  }

  return res.status(200).json({ status: 'ok' });
};
