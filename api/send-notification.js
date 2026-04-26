const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

let subscriptions = [];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action;

  if (action === 'subscribe' && req.method === 'POST') {
    subscriptions.push(req.body);
    return res.status(201).json({ message: 'Subscribed!' });
  }

  if (action === 'send' && req.method === 'POST') {
    const { title, body } = req.body;
    const payload = JSON.stringify({ title, body });

    const results = await Promise.allSettled(
      subscriptions.map(sub => webpush.sendNotification(sub, payload))
    );

    subscriptions = subscriptions.filter((_, i) => results[i].status === 'fulfilled');

    return res.status(200).json({
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    });
  }

  return res.status(200).json({ status: 'ok' });
};
