# SCI GreenTrack — Setup แบบสั้น

ระบบนี้มี 3 ส่วน: **Netlify + Google Apps Script + Google Sheets**

## A) สร้าง Google Sheets Database
1. สร้าง Google Sheet เปล่า 1 ไฟล์ ตั้งชื่อ `SCI GreenTrack Database`.
2. ไปที่ **ส่วนขยาย (Extensions) > Apps Script**.
3. ลบโค้ดเดิมใน `Code.gs` แล้วคัดลอกทั้งหมดจาก `google-apps-script/Code.gs`.
4. กด Save แล้วเลือกฟังก์ชัน `setupSystem` > Run.
5. อนุญาตสิทธิ์ Google ตามหน้าจอ แล้วกรอก **อีเมล Admin / ชื่อ / รหัสผ่าน** ตาม Prompt.
6. กลับมาที่ Google Sheet จะมีตารางถูกสร้างให้อัตโนมัติ.

## B) Deploy Google Apps Script เป็น API
1. ใน Apps Script กด **Deploy > New deployment**.
2. Type = **Web app**.
3. Execute as = **Me**.
4. Who has access = **Anyone**.
5. กด Deploy แล้วคัดลอก URL ที่ลงท้าย `/exec`.
6. กลับ Google Sheet รีโหลดหน้า แล้วเลือกเมนู **SCI GreenTrack > ดู Secret สำหรับ Netlify**.
7. คัดลอก `GAS_SHARED_SECRET`.

> Apps Script เปิด Web app เป็น Anyone ได้ เพราะ API ทุกคำขอต้องผ่าน Shared Secret จาก Netlify Function อีกชั้นหนึ่ง และฟังก์ชันที่แก้ข้อมูลยังต้องมี Session + Role ของผู้ใช้ด้วย

## C) Deploy ขึ้น Netlify
สำหรับโปรเจกต์ที่มี Netlify Functions แนะนำ **Deploy with Git** หรือ Netlify CLI (การลากโฟลเดอร์เฉย ๆ ไม่ใช่วิธีที่แนะนำสำหรับการ build/package Functions).

### วิธี Git (แนะนำ)
1. อัปโหลดโฟลเดอร์โปรเจกต์นี้ขึ้น GitHub repository.
2. Netlify > Add new project > Import an existing project > GitHub > เลือก repo.
3. Build settings ใช้ค่าจาก `netlify.toml` ได้เลย: Publish directory = `.` และ Functions directory = `netlify/functions`.
4. ไปที่ **Site configuration > Environment variables** เพิ่ม:
   - `GAS_WEB_APP_URL` = URL `/exec` จากข้อ B
   - `GAS_SHARED_SECRET` = Secret จากข้อ B
5. Trigger deploy ใหม่หนึ่งครั้ง.

### วิธี Netlify CLI
ที่โฟลเดอร์โปรเจกต์:
```bash
npx netlify-cli login
npx netlify-cli init
npx netlify-cli env:set GAS_WEB_APP_URL "https://script.google.com/macros/s/.../exec"
npx netlify-cli env:set GAS_SHARED_SECRET "..."
npx netlify-cli deploy --prod
```

## D) ทดสอบ
1. เปิด URL Netlify.
2. Login ด้วย Admin ที่สร้างใน `setupSystem()`.
3. ไป `Users & Roles` สร้างบัญชี User ทดลอง.
4. ไป `บันทึกข้อมูล` เพิ่มค่าไฟ/น้ำ.
5. เปิด Google Sheet > `ResourceUsage` จะเห็นข้อมูลใหม่ทันที.
6. ลอง Login ด้วย User: User บันทึกข้อมูลและดูรายงานได้ แต่เมนู Admin จะถูกซ่อนและ API ไม่อนุญาตคำสั่ง Admin.

## เมื่อแก้ Apps Script ภายหลัง
Apps Script > Deploy > Manage deployments > Edit > เลือก **New version** > Deploy เพื่อให้ Web App ใช้โค้ดล่าสุด โดย URL เดิมยังใช้ต่อได้.
