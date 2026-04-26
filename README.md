# PWA Push Notification - Setup Guide

## โครงสร้างไฟล์
```
pwa-push/
├── api/
│   └── send-notification.js   ← Vercel Function (server)
├── public/
│   ├── index.html             ← หน้าเว็บ
│   ├── sw.js                  ← Service Worker
│   └── manifest.json          ← PWA Manifest
├── vercel.json                ← Config สำหรับ Vercel
└── README.md
```

---

## VAPID Keys ที่สร้างไว้แล้ว (เก็บไว้ให้ดี!)

```
PUBLIC KEY:
BHcqrnU7aIOstaLjAwer7hpf6i1rBblmTbA2FZI7YRT81_jIUIdyf2ugqsDAYBsSj4OXFPiCQ1KwqNQg51rpmcg

PRIVATE KEY:
MwY1eFpMeDBTID4Yay7cUCNJhU0o-8v3Xsza_I0QFco
```

⚠️ อย่าแชร์ Private Key ให้ใคร

---

## ขั้นตอนติดตั้ง

### Step 1: สร้าง Vercel Account
1. ไปที่ https://vercel.com
2. Sign up ด้วย GitHub (แนะนำ) หรือ Email
3. ยืนยัน Email

### Step 2: ติดตั้ง Vercel CLI
```bash
npm install -g vercel
```

### Step 3: Deploy
```bash
cd pwa-push
vercel login
vercel --prod
```
Vercel จะถามชื่อ project → พิมพ์ชื่อที่อยากได้ แล้วกด Enter

### Step 4: ตั้ง Environment Variables ใน Vercel
ไปที่ Vercel Dashboard → Project → Settings → Environment Variables

เพิ่ม 3 ตัว:
| Key | Value |
|-----|-------|
| VAPID_PUBLIC_KEY | BHcqrnU7... (Public Key ด้านบน) |
| VAPID_PRIVATE_KEY | MwY1eF... (Private Key ด้านบน) |
| VAPID_EMAIL | mailto:your@email.com |

จากนั้น Redeploy 1 ครั้ง

### Step 5: แก้ไข index.html
เปิด `public/index.html` แก้บรรทัดนี้:
```js
const API_BASE = 'https://YOUR-PROJECT.vercel.app'; // ← ใส่ URL จาก Vercel
```

Deploy ใหม่อีกครั้ง แล้วทดสอบได้เลย!

---

## ตอนย้ายไป Server จริง

แก้แค่ 2 จุด:

**1. Frontend (index.html)**
```js
const API_BASE = 'https://your-real-server.com'; // เปลี่ยน URL
```

**2. Backend**
copy logic จาก `api/send-notification.js` ไปใส่ server จริง
ใช้ library `web-push` เหมือนเดิม ไม่ต้องแก้ sw.js เลย

---

## ทดสอบ
1. เปิดเว็บ → กด "เปิดรับ Notification" → Allow
2. กด "ส่ง Notification"  
3. ควรได้รับ notification ทันที (แม้ปิด tab ไปแล้ว)
