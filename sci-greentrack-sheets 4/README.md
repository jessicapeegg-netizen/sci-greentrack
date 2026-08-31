# SCI GreenTrack — Google Sheets Edition

Web App ติดตามการใช้ทรัพยากรและก๊าซเรือนกระจกสำหรับ Net Zero Campus

## Architecture

```text
Browser
  ↓ same-origin
Netlify Web App
  ↓
Netlify Function (`netlify/functions/api.mjs`)
  ↓ + GAS_SHARED_SECRET (server-side only)
Google Apps Script Web App
  ↓
Google Sheets Database
```

## ฟังก์ชันในระบบ
- Login ด้วย Email + Password
- Session อายุ 8 ชั่วโมง
- Role: `admin` / `user`
- Admin สร้างผู้ใช้และเปลี่ยน Role
- บันทึกการใช้ไฟฟ้า น้ำ ขยะ 4 ประเภท ดีเซล เบนซิน และ GHG
- Dashboard / Resource Analytics / Year-on-Year comparison
- Carbon Center และ Emission Factors
- Net Zero Target
- Action Plan
- Import / Export CSV
- Report สำหรับ Print / Save PDF
- AuditLogs ใน Google Sheets

## สิทธิ์
### User
- ดู Dashboard / Analytics / Carbon / Target / Action Plan / Report
- เพิ่มข้อมูล ResourceUsage

### Admin
- ทุกสิทธิ์ของ User
- Import CSV
- จัดการ Emission Factor
- จัดการ Target
- เพิ่ม/ลบ Action Plan
- สร้าง User และเปลี่ยน Role
- Seed ข้อมูล Demo

## Google Sheets ที่ setupSystem() สร้างให้อัตโนมัติ
- `Users`
- `ResourceUsage`
- `EmissionFactors`
- `Targets`
- `ActionPlans`
- `Sessions`
- `AuditLogs`
- `Settings`

## Security design
- `GAS_SHARED_SECRET` อยู่ใน **Netlify Environment Variables** และ Apps Script Script Properties เท่านั้น ไม่อยู่ใน browser JavaScript.
- รหัสผ่านไม่เก็บเป็น plain text; Apps Script เก็บ HMAC-SHA256 hash พร้อม salt และ secret pepper.
- ทุก API ที่อ่านข้อมูลภายในต้องตรวจ Session.
- คำสั่งสำคัญตรวจ `admin` ซ้ำที่ Apps Script ไม่ได้พึ่งการซ่อนปุ่มใน UI.
- Session token ถูกเก็บใน browser localStorage และหมดอายุภายใน 8 ชั่วโมง.

ระบบ Login นี้ออกแบบให้ใช้งานง่ายสำหรับโครงการ/หน่วยงานขนาดเล็กถึงกลาง หากภายหลังต้องการ SSO ระดับองค์กร สามารถเปลี่ยนชั้น Authentication เป็น Google Identity/OAuth โดยคง Google Sheets และ UI เดิมได้.

## Setup
อ่าน [SETUP-5-MIN.md](./SETUP-5-MIN.md)

## Data source note
ข้อมูลสาธิตในระบบมีไว้ทดสอบ UI เท่านั้น ก่อนอ้างอิงผลจริงให้ Import/บันทึกข้อมูลจริงและระบุแหล่ง Emission Factor ที่หน่วยงานรับรอง.
