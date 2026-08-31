(() => {
  const cfg = window.SCI_CONFIG || {};
  const SESSION_KEY = 'sciGreenTrackSessionV2';
  let session = null;
  let profile = null;
  let authListener = null;

  function configured() {
    return Boolean(String(cfg.API_ENDPOINT || '').trim());
  }

  async function request(action, payload = {}, tokenOverride) {
    const token = tokenOverride !== undefined ? tokenOverride : (session?.access_token || '');
    const res = await fetch(cfg.API_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, token, payload })
    });
    let data;
    try { data = await res.json(); }
    catch { throw new Error('API ตอบกลับไม่ถูกต้อง กรุณาตรวจ Netlify Function และ Apps Script'); }
    if (!res.ok || data.ok === false) throw new Error(data.error || `API error ${res.status}`);
    return data.data;
  }

  function storeSession(value) {
    session = value;
    if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(SESSION_KEY);
  }

  function restoreSession() {
    if (session) return session;
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (raw?.access_token) session = raw;
    } catch {}
    return session;
  }

  async function getSession() {
    const local = restoreSession();
    if (!local?.access_token) return null;
    try {
      const me = await request('me', {}, local.access_token);
      profile = me.profile;
      session = { access_token: local.access_token, user: { id: profile.id, email: profile.email } };
      storeSession(session);
      return session;
    } catch {
      storeSession(null);
      profile = null;
      return null;
    }
  }

  async function loadProfile() {
    if (!session) await getSession();
    if (!session) return null;
    const me = await request('me');
    profile = me.profile;
    return profile;
  }

  async function signIn(email, password) {
    const data = await request('login', { email, password }, '');
    profile = data.profile;
    storeSession({ access_token: data.token, user: { id: profile.id, email: profile.email } });
    authListener?.('SIGNED_IN', session);
    return { session, profile };
  }

  async function signUp(email, password, fullName) {
    const data = await request('signup', { email, password, fullName }, '');
    if (data?.token) {
      profile = data.profile;
      storeSession({ access_token: data.token, user: { id: profile.id, email: profile.email } });
      authListener?.('SIGNED_IN', session);
      return { session, user: session.user };
    }
    return { session: null };
  }

  async function signOut() {
    try { if (session?.access_token) await request('logout'); } catch {}
    storeSession(null);
    profile = null;
    authListener?.('SIGNED_OUT', null);
  }

  function mapRecord(r) {
    return {
      id: r.id,
      year: Number(r.year),
      month: Number(r.month),
      resource: r.resource,
      amount: Number(r.amount),
      building: r.building || '',
      source: r.source || '',
      note: r.note || '',
      createdBy: r.created_by || '',
      createdAt: r.created_at || ''
    };
  }
  function mapTarget(t) {
    return { id: t.id, year: Number(t.year), percent: Number(t.percent), note: t.note || '' };
  }
  function mapAction(a) {
    return {
      id: a.id, title: a.title, resource: a.resource, owner: a.owner || '',
      start: a.start || a.start_date || '', end: a.end || a.end_date || '',
      reduction: Number(a.reduction ?? a.reduction_percent ?? 0), status: a.status || 'วางแผน',
      detail: a.detail || '', createdAt: a.created_at || ''
    };
  }

  async function loadState() {
    const data = await request('state');
    const emissionFactors = {};
    (data.emissionFactors || []).forEach(x => {
      emissionFactors[x.resource] = { factor: x.factor === '' || x.factor == null ? null : Number(x.factor), source: x.source || '' };
    });
    return {
      demo: Boolean(data.demo),
      records: (data.records || []).map(mapRecord),
      targets: (data.targets || []).map(mapTarget),
      actions: (data.actions || []).map(mapAction),
      emissionFactors
    };
  }

  async function insertRecord(record) {
    const data = await request('addRecord', { record });
    return mapRecord(data.record);
  }
  async function bulkInsertRecords(records) {
    const data = await request('bulkAddRecords', { records });
    return (data.records || []).map(mapRecord);
  }
  async function saveEmissionFactor(resource, factor, source) {
    return request('saveEmissionFactor', { resource, factor, source });
  }
  async function saveTarget(target) {
    const data = await request('saveTarget', { target });
    return mapTarget(data.target);
  }
  async function addAction(action) {
    const data = await request('addAction', { action });
    return mapAction(data.action);
  }
  async function deleteAction(id) {
    return request('deleteAction', { id });
  }
  async function listProfiles() {
    const data = await request('listUsers');
    return data.users || [];
  }
  async function setRole(id, role) {
    const data = await request('setRole', { id, role });
    if (profile?.id === id) profile = data.user;
    return data.user;
  }
  async function createUser(fullName, email, password, role = 'user') {
    const data = await request('createUser', { fullName, email, password, role });
    return data.user;
  }
  async function resetPassword(id, password) {
    return request('resetPassword', { id, password });
  }
  async function toggleUser(id, active) {
    return request('toggleUser', { id, active });
  }
  async function seedDemo(state) {
    const data = await request('seedDemo', { state });
    return Number(data.inserted || 0);
  }
  async function ping() { return request('ping', {}, ''); }
  function onAuthStateChange(callback) {
    authListener = callback;
    return { unsubscribe() { if (authListener === callback) authListener = null; } };
  }

  window.Cloud = {
    configured,
    get session() { return restoreSession(); },
    get profile() { return profile; },
    getSession, loadProfile, signIn, signUp, signOut, loadState,
    insertRecord, bulkInsertRecords, saveEmissionFactor, saveTarget,
    addAction, deleteAction, listProfiles, setRole, createUser, resetPassword,
    toggleUser, seedDemo, ping, onAuthStateChange
  };
})();
