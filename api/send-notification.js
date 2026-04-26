const webpush = require('web-push');
const { kv } = require('@vercel/kv');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  // บันทึก subscription ลง KV database
  if (action === 'subscribe' && req.method === 'POST') {
    const subscription = req.body;
    const key = 'sub:' + Buffer.from(subscription.endpoint).toString('base64').slice(0, 20);
    await kv.set(key, JSON.stringify(subscription));
    return res.status(201).json({ message: 'Subscribed!' });
  }

  // ส่ง notification ไปหาทุกคน
  if (action === 'send' && req.method === 'POST') {
    const { title, body } = req.body;
    const payload = JSON.stringify({ title, body });

    // ดึง subscriptions ทั้งหมดจาก KV
    const keys = await kv.keys('sub:*');
    if (keys.length === 0) {
      return res.status(200).json({ sent: 0, failed: 0 });
    }

    const values = await Promise.all(keys.map(k => kv.get(k)));
    const subscriptions = values.map(v => typeof v === 'string' ? JSON.parse(v) : v);

    const results = await Promise.allSettled(
      subscriptions.map((sub, i) =>
        webpush.sendNotification(sub, payload).catch(async err => {
          if (err.statusCode === 410) await kv.del(keys[i]);
          throw err;
        })
      )
    );

    return res.status(200).json({
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      total: keys.length,
    });
  }

  return res.status(200).json({ status: 'ok' });
};
