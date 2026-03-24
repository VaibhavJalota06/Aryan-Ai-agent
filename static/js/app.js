const API = window.location.origin + '/api';
let session = null; // { uid, name, role }
let currentRole = 'admin';
let allFacts = []; // Global store for filtering

// ── UI Navigation ──────────────────────────────────────────────────────────
function showLoginForm(role) {
  currentRole = role;
  document.getElementById('welcomeView').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('formTitle').innerText = role === 'admin' ? '🛡 Administrator Access' : '👥 Team Member Portal';
  
  const btn = document.getElementById('loginBtn');
  btn.className = 'btn ' + (role === 'admin' ? 'btn-a' : 'btn-t');
  btn.innerText = role === 'admin' ? 'Authorize Access' : 'Connect to Portal';
  
  document.getElementById('roleBadge').className = 'badge ' + (role === 'admin' ? 'badge-a' : 'badge-t');
  document.getElementById('roleBadge').innerText = role === 'admin' ? 'Admin Panel' : 'Team Access';
}

function showWelcome() {
  document.getElementById('welcomeView').style.display = 'block';
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('errMsg').classList.remove('show');
}

window.onload = () => {
  // Restore session if available
  const cached = localStorage.getItem('jarvis_session');
  if (cached) {
    session = JSON.parse(cached);
    currentRole = session.role;
    showShell();
  }
};

// ── Login ────────────────────────────────────────────────────────────────────
async function doLogin() {
  const user = document.getElementById('uname').value.trim();
  const pass = document.getElementById('upw').value;
  const btn  = document.getElementById('loginBtn');
  const err  = document.getElementById('errMsg');
  
  if(!user || !pass) return;
  btn.disabled = true; 
  btn.textContent = 'Authenicating...';
  err.classList.remove('show');

  try {
    const res = await fetch(`${API}/login`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username:user, password:pass, role:currentRole})
    });
    const data = await res.json();
    if (data.ok) {
      session = { uid: data.uid, name: data.name, role: data.role };
      localStorage.setItem('jarvis_session', JSON.stringify(session));
      showShell();
    } else {
      err.classList.add('show');
    }
  } catch(e) {
    err.textContent = '⚠ Neural link failed. Server unreachable.';
    err.classList.add('show');
  }
  btn.disabled = false;
  btn.textContent = currentRole === 'admin' ? 'Authorize Access' : 'Connect to Portal';
}

// ── Show shell ───────────────────────────────────────────────────────────────
function showShell() {
  document.getElementById('loginWrap').style.display = 'none';
  document.querySelectorAll('.orb').forEach(o => o.style.display = 'none');
  
  const shell = document.getElementById('shell');
  shell.style.display = 'block';

  const isA = session.role === 'admin';
  const am = document.getElementById('adminMemUI');
  if(am) am.style.display = isA ? 'block' : 'none';
  const pm = document.getElementById('personalContextPanel');
  if(pm) pm.style.display = isA ? 'none' : 'block';
  
  // Topbar
  const av = document.getElementById('avEl');
  av.className = 'av ' + (isA ? 'av-a' : 'av-t');
  av.textContent = session.name[0].toUpperCase();
  document.getElementById('nameEl').textContent = session.name;
  document.getElementById('roleBadge').className = 'badge ' + (isA ? 'badge-a' : 'badge-t');
  document.getElementById('roleBadge').textContent = isA ? 'Admin Panel' : 'Team Access';

  // Sidebar
  const nav = isA
    ? [['📊','Dashboard','pg-dashboard'],['👥','Personnel','pg-users'],['📋','Event Logs','pg-logs'],['🧠','Cognitive DB','pg-memory']]
    : [['💬','Neural Chat','pg-chat'],['🧠','Cognitive DB','pg-memory']];

  const sb = document.getElementById('sidebar');
  sb.innerHTML = nav.map(([ic,lbl,pg]) =>
    `<div class="nav-item" data-page="${pg}" onclick="showPage('${pg}')"><span>${ic}</span> ${lbl}</div>`
  ).join('');

  showPage(nav[0][2]);
}

function showPage(pgId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pgId);
    if (session.role === 'team') n.classList.toggle('teal-nav', n.dataset.page === pgId);
  });
  document.getElementById(pgId).classList.add('active');

  // load data for that page
  if (pgId === 'pg-dashboard') loadDashboard();
  if (pgId === 'pg-users')     loadUsers();
  if (pgId === 'pg-logs')      loadFullLogs();
  if (pgId === 'pg-chat')      initChat();
  if (pgId === 'pg-memory')    loadMemory();
}

// ── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [stats, users, logs] = await Promise.all([
      fetch(`${API}/admin/stats`).then(r=>r.json()),
      fetch(`${API}/admin/users`).then(r=>r.json()),
      fetch(`${API}/admin/logs`).then(r=>r.json()),
    ]);
    document.getElementById('stUsers').textContent = stats.total_users ?? '–';
    document.getElementById('stMsgs').textContent  = stats.messages_today ?? 0;
    document.getElementById('stUp').textContent    = stats.uptime ?? '–';

    const ul = document.getElementById('userList');
    ul.innerHTML = Object.entries(users).map(([uid, u]) => {
      const isA = u.role === 'admin';
      return `<div class="urow">
        <div class="av ${isA?'av-a':'av-t'}" style="width:28px;height:28px;font-size:.72rem;">${u.name[0]}</div>
        <div class="info"><div class="name">${u.name}</div><div class="role">${uid} · ${u.role}</div></div>
        <span class="pill on">Active</span>
      </div>`;
    }).join('');

    const ll = document.getElementById('logList');
    ll.innerHTML = [...logs].reverse().slice(0,8).map(lg =>
      `<div class="log-row"><span class="log-ts">${lg.ts.split('T')[1]} · </span>${lg.event}</div>`
    ).join('') || '<div class="empty">No logs yet.</div>';
  } catch(e) { showToast('Could not load dashboard'); }
}

// ── Users ────────────────────────────────────────────────────────────────────
async function loadUsers() {
  try {
    const users = await fetch(`${API}/admin/users`).then(r=>r.json());
    const el = document.getElementById('allUsers');
    
    let html = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Name</th>
              <th>Identity (UID)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    html += Object.entries(users).map(([uid, u]) => `
            <tr>
              <td>
                <span class="pill ${u.role==='admin'?'on':''}" style="${u.role==='admin'?'':'background: rgba(255,255,255,0.1); color:var(--text);'}">${u.role}</span>
              </td>
              <td style="font-weight:700;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <div class="av ${u.role==='admin'?'av-a':'av-t'}" style="width:24px;height:24px;font-size:0.6rem;">${u.name[0]}</div>
                  ${u.name}
                  <span style="font-size:0.7rem; color:var(--muted); font-weight:normal;">(${u.username})</span>
                </div>
              </td>
              <td style="font-family:'DM Mono',monospace; font-size:0.85rem;">${uid}</td>
              <td>
                ${uid !== session.uid
                  ? `<button class="btn-sm btn-danger" style="padding:4px 10px;font-size:.68rem; border-radius:6px; background:rgba(255,82,82,0.15); color:var(--err); border:1px solid rgba(255,82,82,0.3); cursor:pointer;" onclick="deleteUser('${uid}')">Remove</button>`
                  : '<span class="pill on">You</span>'}
              </td>
            </tr>
    `).join('');
    
    html += `</tbody></table></div>`;
    el.innerHTML = html;
  } catch(e) { showToast('Could not load users'); }
}

async function addUser() {
  const payload = {
    user_id:  document.getElementById('nu-id').value.trim(),
    name:     document.getElementById('nu-name').value.trim(),
    username: document.getElementById('nu-user').value.trim(),
    password: document.getElementById('nu-pw').value,
    role:     document.getElementById('nu-role').value,
  };
  if (!payload.user_id || !payload.name || !payload.username || !payload.password)
    return showToast('Fill in all fields');
  try {
    const res = await fetch(`${API}/admin/users`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) { showToast('✅ User created'); loadUsers(); }
    else         showToast('❌ ' + (data.error || 'Error'));
  } catch(e) { showToast('Server error'); }
}

async function deleteUser(uid) {
  if (!confirm(`Remove user ${uid}?`)) return;
  try {
    await fetch(`${API}/admin/users/${uid}`, {method:'DELETE'});
    showToast('User removed'); loadUsers();
  } catch(e) { showToast('Error'); }
}

function filterUsers() {
  const q = document.getElementById('userSearch').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#allUsers tbody tr');
  rows.forEach(r => {
    const text = r.innerText.toLowerCase();
    r.style.display = text.includes(q) ? '' : 'none';
  });
}

// ── Logs ─────────────────────────────────────────────────────────────────────
async function loadFullLogs() {
  try {
    const logs = await fetch(`${API}/admin/logs`).then(r=>r.json());
    const el = document.getElementById('fullLogs');
    el.innerHTML = [...logs].reverse().map(lg =>
      `<div class="log-row"><span class="log-ts">${lg.ts} · [${lg.user_id}] </span>${lg.event}</div>`
    ).join('') || '<div class="empty">No logs yet.</div>';
  } catch(e) { showToast('Could not load logs'); }
}

// ── Chat ─────────────────────────────────────────────────────────────────────
function initChat() {
  const box = document.getElementById('chatMsgs');
  if (box.children.length === 0)
    appendMsg('agent', `Hello ${session.name}! I am Aryan. How can I assist you today?`);
}

async function sendChat() {
  const inp  = document.getElementById('chatIn');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = ''; inp.disabled = true;
  appendMsg('user', text);
  const loader = appendMsg('agent', '…', true);

  try {
    const res = await fetch(`${API}/chat`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({uid: session.uid, message: text})
    });
    const data = await res.json();
    loader.remove();
    appendMsg('agent', data.reply || data.error || 'No response');
  } catch(e) {
    loader.remove();
    appendMsg('agent', '⚠ Could not reach the server.');
  }
  inp.disabled = false; inp.focus();
}

function appendMsg(who, text, loading=false) {
  const box = document.getElementById('chatMsgs');
  const div = document.createElement('div');
  div.className = 'msg msg-' + who + (loading ? ' msg-loading' : '');
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

// ── Memory ───────────────────────────────────────────────────────────────────
async function loadMemory() {
  try {
    const data = await fetch(`${API}/memory/${session.uid}`, { cache: 'no-store' }).then(r=>r.json());
    allFacts = data.facts || [];
    renderFacts(allFacts);
    
    document.getElementById('memStats').textContent =
      `${data.message_count} messages stored across all sessions.`;
  } catch(e) { showToast('Could not load memory'); }
}

function renderFacts(facts) {
  const fa = document.getElementById('factsArea');
  const bc = document.getElementById('bulkControls');
  
  if (facts && facts.length) {
    if (bc && session.role === 'admin') bc.style.display = 'flex';
    
    // Group by title
    const groups = {};
    const isA = session.role === 'admin';
    facts.forEach((f, idx) => {
      const t = f.title || 'General';
      if (!groups[t]) groups[t] = [];
      groups[t].push({fact: f.fact, idx: idx});
    });
    
    let html = '';
    for (const [title, facts] of Object.entries(groups)) {
      html += `<div class="mem-group">
        <div class="mem-title">${title}</div>
        <div class="mem-list">
          ${facts.map(f => `
            <div class="chk-row" style="align-items: flex-start;">
              <span class="fact-chip" style="font-weight:600; color:var(--text); white-space: pre-wrap; word-break: break-word;">${f.fact}</span>
              ${isA ? `<input type="checkbox" class="fact-check custom-chk" data-idx="${f.idx}" style="margin-top: 4px;" />` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    }
    fa.innerHTML = html;
  } else {
    if (bc) bc.style.display = 'none';
    fa.innerHTML = '<div class="empty">No facts match your query or none saved yet.</div>';
  }
}

function filterMemory() {
  const query = document.getElementById('memSearch').value.toLowerCase().trim();
  if (!query) return renderFacts(allFacts);
  
  const filtered = allFacts.filter(f => 
    (f.title && f.title.toLowerCase().includes(query)) || 
    (f.fact && f.fact.toLowerCase().includes(query))
  );
  renderFacts(filtered);
}

// Category toggle removed in favor of direct Title input

function setMemTitle(t) {
  document.getElementById('memTitle').value = t;
  document.getElementById('memIn').focus();
}

function toggleAllFacts(chk) {
  document.querySelectorAll('.fact-check').forEach(c => c.checked = chk.checked);
}

async function addFact() {
  const elFact = document.getElementById('memIn');
  const elTitle = document.getElementById('memTitle');
  
  const factHtml = elFact.innerHTML.trim();
  const factText = elFact.innerText.trim();
  const title = elTitle.value.trim() || 'General';
  
  if(!factText || !session) return showToast('Entry required');

  // Systematic check: Prevent duplicates
  const isDup = allFacts.some(f => f.fact.toLowerCase() === factHtml.toLowerCase() && (f.title || 'General').toLowerCase() === title.toLowerCase());
  if (isDup) return showToast('⚠ Information already indexed');
  
  const fact = factHtml;

  try {
    const r = await fetch(`${API}/memory/${session.uid}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact, title, role: session.role })
    });
    if(r.ok) {
      elFact.innerHTML = ''; elTitle.value = '';
      const cc = document.getElementById('charCount');
      if(cc) cc.innerText = '0';
      showToast(`✅ Indexed under [${title}]`);
      await loadMemory();
    }
  } catch(e) { console.error(e); showToast('❌ Error saving fact'); }
}

async function clearMemory() {
  if (!confirm('Clear your private chat history? This cannot be undone.')) return;
  try {
    const r = await fetch(`${API}/memory/${session.uid}/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: session.role })
    });
    if(r.ok) {
      showToast('✅ Private history cleared');
      await loadMemory();
      const box = document.getElementById('chatMsgs');
      if (box) {
        box.innerHTML = '';
        appendMsg('agent', `Hello ${session.name}! How can I help you today?`);
      }
    }
  } catch(e) { showToast('❌ Error clearing history'); }
}

async function deleteSelectedFacts() {
  const checks = document.querySelectorAll('.fact-check:checked');
  if (checks.length === 0) return showToast('No facts selected');
  
  if (!confirm(`Delete ${checks.length} selected facts?`)) return;
  
  const indices = Array.from(checks).map(c => parseInt(c.dataset.idx));
  try {
    const r = await fetch(`${API}/admin/memory/delete_facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: session.role, indices: indices, uid: session.uid })
    });
    if(r.ok) {
      showToast(`✅ Deleted ${checks.length} facts`);
      await loadMemory();
    } else {
      showToast('❌ Permission denied or error');
    }
  } catch(e) { showToast('❌ Error deleting facts'); }
}

async function clearGlobalMemory() {
  if (!confirm('DANGER: This will wipe the ENTIRE shared knowledge base for ALL users. Proceed?')) return;
  try {
    const r = await fetch(`${API}/admin/memory/clear_global`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: session.role, uid: session.uid })
    });
    if(r.ok) {
      showToast('✅ Global knowledge base wiped');
      await loadMemory();
    } else {
      showToast('❌ Permission denied');
    }
  } catch(e) { showToast('❌ Error clearing global knowledge'); }
}

// ── Logout ───────────────────────────────────────────────────────────────────
function doLogout() {
  localStorage.removeItem('jarvis_session');
  window.location.href = '/';
}

// ── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}