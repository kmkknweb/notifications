const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

// เก็บ tokens ใน memory (ทดสอบ)
let tokens = [];

let app;
function getApp() {
  if (!app) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return app;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  if (action === 'subscribe' && req.method === 'POST') {
    const { token } = req.body;
    if (token && !tokens.includes(token)) {
      tokens.push(token);
    }
    return res.status(201).json({ message: 'Subscribed!', total: tokens.length });
  }

  if (action === 'send' && req.method === 'POST') {
    const { title, body } = req.body;

    if (tokens.length === 0) {
      return res.status(200).json({ sent: 0, failed: 0, message: 'No subscribers' });
    }

    try {
      getApp();
      const messaging = getMessaging();

      const results = await Promise.allSettled(
        tokens.map(token =>
          messaging.send({
            token,
            notification: { title, body },
            webpush: {
              notification: { title, body, icon: '/icon-192.png' },
            },
          })
        )
      );

      const failed = results.filter(r => r.status === 'rejected');
      tokens = tokens.filter((_, i) => results[i].status === 'fulfilled');

      return res.status(200).json({
        sent: results.filter(r => r.status === 'fulfilled').length,
        failed: failed.length,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(200).json({ status: 'ok', subscribers: tokens.length });
};
