/**
 * SCI GreenTrack — Google Apps Script API
 * ใช้คู่กับ Netlify Function และ Google Sheets
 *
 * SETUP:
 * 1) สร้าง Google Sheet เปล่า > Extensions > Apps Script
 * 2) วางไฟล์นี้ทั้งหมด
 * 3) Run setupSystem() หนึ่งครั้ง และกรอก Admin ตามหน้าต่าง Prompt
 * 4) Deploy > New deployment > Web app > Execute as Me > Who has access: Anyone
 * 5) Run showConnectionInfo() เพื่อดู GAS_SHARED_SECRET
 */

const APP = {
  SESSION_HOURS: 8,
  RESOURCES: ['electricity','water','general_waste','recycle','organic','hazardous','diesel','gasoline','ghg'],
  SHEETS: {
    Users: ['id','email','full_name','password_salt','password_hash','role','active','created_at','last_login'],
    ResourceUsage: ['id','year','month','resource','amount','building','source','note','created_by','created_at'],
    EmissionFactors: ['resource','factor','unit','source','updated_by','updated_at'],
    Targets: ['id','year','percent','note','updated_by','updated_at'],
    ActionPlans: ['id','title','resource','owner','start','end','reduction','status','detail','created_by','created_at'],
    Sessions: ['token','user_id','expires_at','created_at'],
    AuditLogs: ['id','timestamp','user_id','email','action','detail'],
    Settings: ['key','value']
  }
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('SCI GreenTrack')
    .addItem('1) ตั้งค่าระบบครั้งแรก', 'setupSystem')
    .addItem('2) ดู Secret สำหรับ Netlify', 'showConnectionInfo')
    .addSeparator()
    .addItem('สร้างข้อมูลสาธิต', 'seedDemoDataFromMenu')
    .addItem('ล้าง Session ที่หมดอายุ', 'cleanupExpiredSessions')
    .addToUi();
}

function setupSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('กรุณาเปิด Apps Script จาก Google Sheet ที่ต้องการใช้เป็นฐานข้อมูล');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  ensureSecrets_();
  ensureSheets_();
  seedResourceMaster_();
  setSetting_('DEMO_MODE', 'false');
  setSetting_('ALLOW_SELF_SIGNUP', 'false');

  const users = getRows_('Users');
  if (users.length === 0) {
    const ui = SpreadsheetApp.getUi();
    const emailPrompt = ui.prompt('สร้างผู้ดูแลระบบ', 'กรอกอีเมล Admin', ui.ButtonSet.OK_CANCEL);
    if (emailPrompt.getSelectedButton() !== ui.Button.OK) return;
    const namePrompt = ui.prompt('สร้างผู้ดูแลระบบ', 'กรอกชื่อที่แสดง', ui.ButtonSet.OK_CANCEL);
    if (namePrompt.getSelectedButton() !== ui.Button.OK) return;
    const passPrompt = ui.prompt('สร้างผู้ดูแลระบบ', 'ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร', ui.ButtonSet.OK_CANCEL);
    if (passPrompt.getSelectedButton() !== ui.Button.OK) return;
    createUserInternal_(namePrompt.getResponseText(), emailPrompt.getResponseText(), passPrompt.getResponseText(), 'admin');
  }

  SpreadsheetApp.getUi().alert(
    'ตั้งค่า SCI GreenTrack สำเร็จ',
    'สร้างตารางฐานข้อมูลครบแล้ว\n\nขั้นต่อไป: Deploy เป็น Web app แล้วใช้เมนู “ดู Secret สำหรับ Netlify”',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function showConnectionInfo() {
  ensureSecrets_();
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('API_SHARED_SECRET');
  const url = ScriptApp.getService().getUrl() || '(ยังไม่ได้ Deploy เป็น Web app)';
  SpreadsheetApp.getUi().alert(
    'ข้อมูลสำหรับ Netlify',
    'GAS_WEB_APP_URL:\n' + url + '\n\nGAS_SHARED_SECRET:\n' + secret + '\n\nเก็บ Secret นี้ไว้เฉพาะใน Netlify Environment Variables',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function doGet() {
  return json_({ ok: true, data: { app: 'SCI GreenTrack Google Sheets API', status: 'online' } });
}

function doPost(e) {
  try {
    ensureSecrets_();
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('API_SHARED_SECRET');
    if (!body.sharedSecret || body.sharedSecret !== expected) throw new Error('Unauthorized API client');
    const action = String(body.action || '');
    const payload = body.payload || {};
    const token = String(body.token || '');

    let data;
    switch (action) {
      case 'ping': data = { app: 'SCI GreenTrack', status: 'online', time: now_() }; break;
      case 'login': data = login_(payload); break;
      case 'logout': data = logout_(token); break;
      case 'signup': data = signup_(payload); break;
      case 'me': data = { profile: publicUser_(requireUser_(token)) }; break;
      case 'state': data = state_(requireUser_(token)); break;
      case 'addRecord': data = addRecord_(requireUser_(token), payload.record || {}); break;
      case 'bulkAddRecords': data = bulkAddRecords_(requireAdmin_(token), payload.records || []); break;
      case 'saveEmissionFactor': data = saveEmissionFactor_(requireAdmin_(token), payload); break;
      case 'saveTarget': data = saveTarget_(requireAdmin_(token), payload.target || {}); break;
      case 'addAction': data = addAction_(requireAdmin_(token), payload.action || {}); break;
      case 'deleteAction': data = deleteAction_(requireAdmin_(token), payload.id); break;
      case 'listUsers': data = listUsers_(requireAdmin_(token)); break;
      case 'setRole': data = setRole_(requireAdmin_(token), payload.id, payload.role); break;
      case 'createUser': data = createUser_(requireAdmin_(token), payload); break;
      case 'resetPassword': data = resetPassword_(requireAdmin_(token), payload.id, payload.password); break;
      case 'toggleUser': data = toggleUser_(requireAdmin_(token), payload.id, payload.active); break;
      case 'seedDemo': data = seedDemo_(requireAdmin_(token), payload.state || {}); break;
      default: throw new Error('Unknown action: ' + action);
    }
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

// ---------- Authentication ----------
function login_(payload) {
  const email = normalizeEmail_(payload.email);
  const password = String(payload.password || '');
  if (!email || !password) throw new Error('กรุณากรอกอีเมลและรหัสผ่าน');
  cleanupExpiredSessions();
  const user = getRows_('Users').find(r => normalizeEmail_(r.email) === email);
  if (!user || String(user.active).toLowerCase() !== 'true') throw new Error('ไม่พบบัญชีหรือบัญชีถูกปิดใช้งาน');
  const hash = hashPassword_(password, user.password_salt);
  if (hash !== String(user.password_hash)) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');

  const token = newToken_();
  const created = new Date();
  const expires = new Date(created.getTime() + APP.SESSION_HOURS * 60 * 60 * 1000);
  appendObject_('Sessions', { token, user_id: user.id, expires_at: expires.toISOString(), created_at: created.toISOString() });
  updateByKey_('Users', 'id', user.id, { last_login: created.toISOString() });
  audit_(user, 'LOGIN', 'เข้าสู่ระบบ');
  return { token, profile: publicUser_(user), expires_at: expires.toISOString() };
}

function logout_(token) {
  if (token) deleteByKey_('Sessions', 'token', token);
  return { success: true };
}

function signup_(payload) {
  const users = getRows_('Users');
  const allow = String(getSetting_('ALLOW_SELF_SIGNUP') || 'false').toLowerCase() === 'true';
  if (users.length > 0 && !allow) throw new Error('ปิดการสมัครบัญชีด้วยตนเอง กรุณาให้ Admin สร้างบัญชีในเมนู Users & Roles');
  const role = users.length === 0 ? 'admin' : 'user';
  const user = createUserInternal_(payload.fullName, payload.email, payload.password, role);
  return login_({ email: user.email, password: payload.password });
}

function requireUser_(token) {
  if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
  cleanupExpiredSessions();
  const session = getRows_('Sessions').find(r => String(r.token) === token);
  if (!session) throw new Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  const user = getRows_('Users').find(r => String(r.id) === String(session.user_id));
  if (!user || String(user.active).toLowerCase() !== 'true') throw new Error('บัญชีถูกปิดใช้งาน');
  return user;
}

function requireAdmin_(token) {
  const user = requireUser_(token);
  if (String(user.role) !== 'admin') throw new Error('ต้องใช้สิทธิ์ Admin');
  return user;
}

function cleanupExpiredSessions() {
  const sheet = sheet_('Sessions');
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return;
  const now = Date.now();
  for (let i = values.length - 1; i >= 1; i--) {
    const expires = new Date(values[i][2]).getTime();
    if (!expires || expires <= now) sheet.deleteRow(i + 1);
  }
}

// ---------- State / Resources ----------
function state_() {
  return {
    demo: String(getSetting_('DEMO_MODE') || 'false').toLowerCase() === 'true',
    records: getRows_('ResourceUsage'),
    emissionFactors: getRows_('EmissionFactors'),
    targets: getRows_('Targets'),
    actions: getRows_('ActionPlans')
  };
}

function addRecord_(user, record) {
  const clean = validateRecord_(record);
  clean.id = uuid_();
  clean.created_by = user.email;
  clean.created_at = now_();
  appendObject_('ResourceUsage', clean);
  setSetting_('DEMO_MODE', 'false');
  audit_(user, 'ADD_RESOURCE', JSON.stringify({ year: clean.year, month: clean.month, resource: clean.resource, amount: clean.amount }));
  return { record: clean };
}

function bulkAddRecords_(user, records) {
  if (!Array.isArray(records) || !records.length) throw new Error('ไม่มีข้อมูลสำหรับนำเข้า');
  if (records.length > 1500) throw new Error('นำเข้าได้สูงสุดครั้งละ 1,500 รายการ');
  const rows = records.map(r => {
    const clean = validateRecord_(r);
    clean.id = uuid_(); clean.created_by = user.email; clean.created_at = now_();
    return clean;
  });
  appendObjects_('ResourceUsage', rows);
  setSetting_('DEMO_MODE', 'false');
  audit_(user, 'BULK_IMPORT', 'นำเข้า ' + rows.length + ' รายการ');
  return { records: rows };
}

function validateRecord_(r) {
  const year = Number(r.year), month = Number(r.month), amount = Number(r.amount);
  const resource = String(r.resource || '').trim();
  if (!Number.isFinite(year) || year < 2500 || year > 2700) throw new Error('ปีไม่ถูกต้อง');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('เดือนไม่ถูกต้อง');
  if (APP.RESOURCES.indexOf(resource) < 0) throw new Error('ประเภททรัพยากรไม่ถูกต้อง: ' + resource);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('ปริมาณไม่ถูกต้อง');
  return { year, month, resource, amount, building: String(r.building || ''), source: String(r.source || ''), note: String(r.note || '') };
}

function saveEmissionFactor_(user, p) {
  const resource = String(p.resource || '');
  if (APP.RESOURCES.indexOf(resource) < 0 || resource === 'ghg') throw new Error('ประเภททรัพยากรไม่ถูกต้อง');
  const factor = (p.factor === '' || p.factor == null) ? '' : Number(p.factor);
  if (factor !== '' && (!Number.isFinite(factor) || factor < 0)) throw new Error('Emission Factor ไม่ถูกต้อง');
  const unitMap = { electricity:'kgCO2e/kWh', water:'kgCO2e/m3', general_waste:'kgCO2e/kg', recycle:'kgCO2e/kg', organic:'kgCO2e/kg', hazardous:'kgCO2e/kg', diesel:'kgCO2e/L', gasoline:'kgCO2e/L' };
  upsertByKey_('EmissionFactors', 'resource', resource, { resource, factor, unit: unitMap[resource] || '', source: String(p.source || ''), updated_by: user.email, updated_at: now_() });
  audit_(user, 'SAVE_EF', resource + '=' + factor);
  return { resource, factor, source: String(p.source || '') };
}

function saveTarget_(user, target) {
  const year = Number(target.year), percent = Number(target.percent);
  if (!Number.isFinite(year) || !Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Target ไม่ถูกต้อง');
  let current = getRows_('Targets').find(r => Number(r.year) === year);
  const row = { id: current ? current.id : uuid_(), year, percent, note: String(target.note || ''), updated_by: user.email, updated_at: now_() };
  upsertByKey_('Targets', 'year', year, row);
  audit_(user, 'SAVE_TARGET', year + ': ' + percent + '%');
  return { target: row };
}

function addAction_(user, action) {
  if (!String(action.title || '').trim()) throw new Error('กรุณาระบุชื่อมาตรการ');
  const row = {
    id: uuid_(), title: String(action.title), resource: String(action.resource || 'electricity'), owner: String(action.owner || ''),
    start: String(action.start || ''), end: String(action.end || ''), reduction: Number(action.reduction || 0),
    status: String(action.status || 'วางแผน'), detail: String(action.detail || ''), created_by: user.email, created_at: now_()
  };
  appendObject_('ActionPlans', row);
  audit_(user, 'ADD_ACTION', row.title);
  return { action: row };
}

function deleteAction_(user, id) {
  deleteByKey_('ActionPlans', 'id', String(id));
  audit_(user, 'DELETE_ACTION', String(id));
  return { success: true };
}

// ---------- Users ----------
function listUsers_() {
  return { users: getRows_('Users').map(publicUser_) };
}

function createUser_(admin, p) {
  const user = createUserInternal_(p.fullName, p.email, p.password, p.role || 'user');
  audit_(admin, 'CREATE_USER', user.email + ' (' + user.role + ')');
  return { user: publicUser_(user) };
}

function createUserInternal_(fullName, emailRaw, passwordRaw, roleRaw) {
  const email = normalizeEmail_(emailRaw);
  const password = String(passwordRaw || '');
  const role = String(roleRaw || 'user') === 'admin' ? 'admin' : 'user';
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('อีเมลไม่ถูกต้อง');
  if (password.length < 8) throw new Error('รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร');
  if (getRows_('Users').some(r => normalizeEmail_(r.email) === email)) throw new Error('อีเมลนี้มีบัญชีแล้ว');
  const salt = uuid_() + uuid_();
  const user = { id: uuid_(), email, full_name: String(fullName || email.split('@')[0]), password_salt: salt, password_hash: hashPassword_(password, salt), role, active: true, created_at: now_(), last_login: '' };
  appendObject_('Users', user);
  return user;
}

function setRole_(admin, id, roleRaw) {
  const role = String(roleRaw);
  if (['admin','user'].indexOf(role) < 0) throw new Error('Role ไม่ถูกต้อง');
  const users = getRows_('Users');
  const target = users.find(u => String(u.id) === String(id));
  if (!target) throw new Error('ไม่พบผู้ใช้');
  if (target.role === 'admin' && role === 'user') {
    const activeAdmins = users.filter(u => u.role === 'admin' && String(u.active).toLowerCase() === 'true');
    if (activeAdmins.length <= 1) throw new Error('ไม่สามารถลดสิทธิ์ Admin คนสุดท้ายได้');
  }
  updateByKey_('Users', 'id', id, { role });
  audit_(admin, 'SET_ROLE', target.email + ' -> ' + role);
  return { user: publicUser_(Object.assign({}, target, { role })) };
}

function resetPassword_(admin, id, passwordRaw) {
  const password = String(passwordRaw || '');
  if (password.length < 8) throw new Error('รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร');
  const target = getRows_('Users').find(u => String(u.id) === String(id));
  if (!target) throw new Error('ไม่พบผู้ใช้');
  const salt = uuid_() + uuid_();
  updateByKey_('Users', 'id', id, { password_salt: salt, password_hash: hashPassword_(password, salt) });
  deleteSessionsForUser_(id);
  audit_(admin, 'RESET_PASSWORD', target.email);
  return { success: true };
}

function toggleUser_(admin, id, activeRaw) {
  const active = Boolean(activeRaw);
  const users = getRows_('Users');
  const target = users.find(u => String(u.id) === String(id));
  if (!target) throw new Error('ไม่พบผู้ใช้');
  if (!active && target.role === 'admin') {
    const activeAdmins = users.filter(u => u.role === 'admin' && String(u.active).toLowerCase() === 'true');
    if (activeAdmins.length <= 1) throw new Error('ไม่สามารถปิด Admin คนสุดท้ายได้');
  }
  updateByKey_('Users', 'id', id, { active });
  if (!active) deleteSessionsForUser_(id);
  audit_(admin, active ? 'ENABLE_USER' : 'DISABLE_USER', target.email);
  return { user: publicUser_(Object.assign({}, target, { active })) };
}

// ---------- Demo ----------
function seedDemo_(user, state) {
  const records = Array.isArray(state.records) ? state.records : [];
  if (!records.length) throw new Error('ไม่พบข้อมูลสาธิต');
  const rows = records.slice(0, 1500).map(r => {
    const clean = validateRecord_(r); clean.id = uuid_(); clean.created_by = user.email; clean.created_at = now_(); return clean;
  });
  appendObjects_('ResourceUsage', rows);
  (state.targets || []).forEach(t => saveTarget_(user, t));
  (state.actions || []).forEach(a => addAction_(user, a));
  setSetting_('DEMO_MODE', 'true');
  audit_(user, 'SEED_DEMO', String(rows.length));
  return { inserted: rows.length };
}

function seedDemoDataFromMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('ข้อมูลสาธิตควรนำเข้าผ่านหน้าเว็บ SCI GreenTrack เพื่อให้รูปแบบข้อมูลตรงกับ Dashboard');
}

// ---------- Setup / Sheet helpers ----------
function ensureSecrets_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_SHARED_SECRET')) props.setProperty('API_SHARED_SECRET', uuid_() + uuid_() + uuid_());
  if (!props.getProperty('AUTH_PEPPER')) props.setProperty('AUTH_PEPPER', uuid_() + uuid_());
}

function ensureSheets_() {
  const ss = spreadsheet_();
  Object.keys(APP.SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = APP.SHEETS[name];
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    else {
      const current = sh.getRange(1,1,1,Math.max(sh.getLastColumn(), headers.length)).getValues()[0];
      headers.forEach((h,i) => { if (current[i] !== h) sh.getRange(1,i+1).setValue(h); });
    }
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#0b7a53').setFontColor('#ffffff');
    sh.autoResizeColumns(1, headers.length);
  });
}

function seedResourceMaster_() {
  const unitMap = { electricity:'kgCO2e/kWh', water:'kgCO2e/m3', general_waste:'kgCO2e/kg', recycle:'kgCO2e/kg', organic:'kgCO2e/kg', hazardous:'kgCO2e/kg', diesel:'kgCO2e/L', gasoline:'kgCO2e/L' };
  Object.keys(unitMap).forEach(resource => {
    if (!getRows_('EmissionFactors').some(r => r.resource === resource)) {
      appendObject_('EmissionFactors', { resource, factor:'', unit:unitMap[resource], source:'', updated_by:'', updated_at:'' });
    }
  });
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('ยังไม่ได้ตั้งค่า SPREADSHEET_ID ให้ Run setupSystem() ก่อน');
  return active;
}
function sheet_(name) { const sh = spreadsheet_().getSheetByName(name); if (!sh) throw new Error('ไม่พบ Sheet: ' + name + ' ให้ Run setupSystem()'); return sh; }
function headers_(name) { return APP.SHEETS[name]; }
function getRows_(name) {
  const sh = sheet_(name); const values = sh.getDataRange().getValues(); if (values.length <= 1) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row => {
    const obj = {}; headers.forEach((h,i) => obj[h] = serialize_(row[i])); return obj;
  });
}
function appendObject_(name, obj) { appendObjects_(name, [obj]); }
function appendObjects_(name, objects) {
  if (!objects.length) return;
  const sh = sheet_(name), hs = headers_(name);
  const values = objects.map(o => hs.map(h => o[h] === undefined ? '' : o[h]));
  sh.getRange(sh.getLastRow()+1, 1, values.length, hs.length).setValues(values);
}
function updateByKey_(name, key, value, patch) {
  const sh = sheet_(name), values = sh.getDataRange().getValues(), hs = values[0].map(String), keyIdx = hs.indexOf(key);
  if (keyIdx < 0) throw new Error('ไม่พบ key ' + key);
  for (let i=1;i<values.length;i++) if (String(values[i][keyIdx]) === String(value)) {
    Object.keys(patch).forEach(k => { const idx=hs.indexOf(k); if(idx>=0) sh.getRange(i+1,idx+1).setValue(patch[k]); });
    return true;
  }
  return false;
}
function upsertByKey_(name, key, value, obj) { if (!updateByKey_(name,key,value,obj)) appendObject_(name,obj); }
function deleteByKey_(name, key, value) {
  const sh=sheet_(name), values=sh.getDataRange().getValues(), idx=values[0].map(String).indexOf(key); if(idx<0)return false;
  for(let i=values.length-1;i>=1;i--) if(String(values[i][idx])===String(value)) { sh.deleteRow(i+1); return true; }
  return false;
}
function deleteSessionsForUser_(userId) {
  const sh=sheet_('Sessions'), values=sh.getDataRange().getValues();
  for(let i=values.length-1;i>=1;i--) if(String(values[i][1])===String(userId)) sh.deleteRow(i+1);
}

function getSetting_(key) { const row=getRows_('Settings').find(r=>String(r.key)===String(key)); return row ? row.value : ''; }
function setSetting_(key,value) { upsertByKey_('Settings','key',key,{key,value:String(value)}); }
function audit_(user, action, detail) { appendObject_('AuditLogs',{id:uuid_(),timestamp:now_(),user_id:user?.id||'',email:user?.email||'',action,detail:String(detail||'').slice(0,1000)}); }
function publicUser_(u) { return { id:String(u.id), email:String(u.email), full_name:String(u.full_name||''), role:String(u.role||'user'), active:String(u.active).toLowerCase()==='true', created_at:String(u.created_at||''), last_login:String(u.last_login||'') }; }
function normalizeEmail_(v) { return String(v||'').trim().toLowerCase(); }
function uuid_() { return Utilities.getUuid().replace(/-/g,''); }
function newToken_() { return uuid_()+uuid_()+uuid_(); }
function now_() { return new Date().toISOString(); }
function serialize_(v) { return Object.prototype.toString.call(v)==='[object Date]' ? v.toISOString() : v; }
function hashPassword_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('AUTH_PEPPER') || '';
  const bytes = Utilities.computeHmacSha256Signature(String(password), String(salt) + pepper, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join('');
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
