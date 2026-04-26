const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;

const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

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

  if (data.error) {
    throw new Error(data.error);
  }

  return data.result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action;

  if (action === 'subscribe' && req.method === 'POST') {
    try {
      const subscription = req.body;

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({
          ok: false,
          message: 'ไม่มี subscription endpoint',
        });
      }

      const key =
        'sub:' +
        Buffer.from(subscription.endpoint)
          .toString('base64')
          .replace(/=/g, '')
          .slice(-40);

      await redisCmd(['SET', key, JSON.stringify(subscription)]);

      console.log('SUBSCRIBED:', key);
      console.log('ENDPOINT:', subscription.endpoint);

      return res.status(201).json({
        ok: true,
        message: 'Subscribed',
        key,
      });
    } catch (err) {
      console.log('SUBSCRIBE ERROR:', err.message);

      return res.status(500).json({
        ok: false,
        message: err.message,
      });
    }
  }

  if (action === 'send' && req.method === 'POST') {
    try {
      const { title, body, url } = req.body || {};

      const payload = JSON.stringify({
        title: title || 'ประกาศจากศาลเจ้า',
        body: body || 'มีข่าวสารใหม่',
        url: url || '/',
      });

      const keys = await redisCmd(['KEYS', 'sub:*']);

      if (!keys || keys.length === 0) {
        return res.status(200).json({
          ok: true,
          sent: 0,
          failed: 0,
          total: 0,
          message: 'ไม่มี subscription',
        });
      }

      let sent = 0;
      let failed = 0;
      const errors = [];

      for (const key of keys) {
        const value = await redisCmd(['GET', key]);

        if (!value) {
          await redisCmd(['DEL', key]);
          continue;
        }

        let sub;

        try {
          sub = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
          failed++;
          errors.push({ key, error: 'JSON parse failed' });
          await redisCmd(['DEL', key]);
          continue;
        }

        try {
          console.log('กำลังส่งไป:', sub.endpoint);

          await webpush.sendNotification(sub, payload);

          sent++;
          console.log('SEND OK:', key);
        } catch (err) {
          failed++;

          console.log('ERROR:', err.statusCode, err.body || err.message);

          errors.push({
            key,
            statusCode: err.statusCode || null,
            body: err.body || err.message || '',
          });

          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log('ลบ subscription ที่ตาย:', key);
            await redisCmd(['DEL', key]);
          }
        }
      }

      return res.status(200).json({
        ok: true,
        total: keys.length,
        sent,
        failed,
        errors,
      });
    } catch (err) {
      console.log('SEND API ERROR:', err.message);

      return res.status(500).json({
        ok: false,
        sent: 0,
        failed: 0,
        message: err.message,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    status: 'api ready',
  });
};
