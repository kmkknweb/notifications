const webpush = require('web-push');

// ใส่ VAPID keys ของคุณที่นี่
// หรือใช้ Environment Variables ใน Vercel Dashboard (แนะนำ)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:your@email.com';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// เก็บ subscriptions ในหน่วยความจำชั่วคราว (ใช้แค่ทดสอบ)
// ตอน server จริงพร้อม → ย้ายไปเก็บใน Database
let subscriptions = [];

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // บันทึก subscription จาก browser
  if (req.method === 'POST' && req.url.includes('/subscribe')) {
    const subscription = req.body;
    subscriptions.push(subscription);
    console.log('New subscription saved:', subscription.endpoint);
    return res.status(201).json({ message: 'Subscribed!' });
  }

  // ส่ง notification ไปหาทุกคน
  if (req.method === 'POST' && req.url.includes('/send')) {
    const { title, body, icon } = req.body;

    const payload = JSON.stringify({
      title: title || 'แจ้งเตือน',
      body: body || 'มีข้อความใหม่',
      icon: icon || '/icon.png',
    });

    const results = await Promise.allSettled(
      subscriptions.map(sub => webpush.sendNotification(sub, payload))
    );

    // ลบ subscription ที่ไม่ valid ออก
    subscriptions = subscriptions.filter((_, i) => results[i].status === 'fulfilled');

    return res.status(200).json({
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    });
  }

  return res.status(404).json({ error: 'Not found' });
}
