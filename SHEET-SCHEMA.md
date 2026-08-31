# Google Sheets Schema

| Sheet | Columns |
|---|---|
| Users | id, email, full_name, password_salt, password_hash, role, active, created_at, last_login |
| ResourceUsage | id, year, month, resource, amount, building, source, note, created_by, created_at |
| EmissionFactors | resource, factor, unit, source, updated_by, updated_at |
| Targets | id, year, percent, note, updated_by, updated_at |
| ActionPlans | id, title, resource, owner, start, end, reduction, status, detail, created_by, created_at |
| Sessions | token, user_id, expires_at, created_at |
| AuditLogs | id, timestamp, user_id, email, action, detail |
| Settings | key, value |

`setupSystem()` สร้าง Headers, Freeze แถวแรก และตั้งสีหัวตารางให้อัตโนมัติ.
