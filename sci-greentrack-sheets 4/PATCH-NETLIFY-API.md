# แก้ Netlify API ถูก Redirect ไป index.html

แก้ 3 ไฟล์ใน GitHub แล้ว Commit:

1. `_redirects`
```
/api /.netlify/functions/api 200
```

2. `netlify.toml`
```toml
[build]
  publish = "."
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api"
  to = "/.netlify/functions/api"
  status = 200
```

3. `config.js`
```js
window.SCI_CONFIG = {
  API_ENDPOINT: '/api'
};
```

หลัง Commit รอ Netlify deploy ใหม่ แล้วทดสอบ:
- `https://<site>.netlify.app/.netlify/functions/api` ควรตอบ JSON Method not allowed เมื่อเปิดด้วย GET
- `https://<site>.netlify.app/api` ควรตอบ JSON Method not allowed เมื่อเปิดด้วย GET

จากนั้นทดสอบ Login ใหม่
