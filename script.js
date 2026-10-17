/* ============================================================
   Filio Investment Hub — User App (complete)
   ============================================================ */

const PLANS = {
  bronze:   { name:'Bronze',   price:5000,  return:7000,  days:10 },
  silver:   { name:'Silver',   price:7000,  return:12000, days:10 },
  platinum: { name:'Platinum', price:10000, return:16000, days:10 },
  gold:     { name:'Gold',     price:15000, return:25000, days:10 },
};

const KEYS = {
  theme:'filio_theme', ui:'filio_ui',
};

const $ = id => document.getElementById(id);
const load = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const fmt = n => '₦' + Number(n || 0).toLocaleString('en-NG');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

let sessionUser = null;
let userDataCache = null;
let userDeposits = [];
let userWithdrawals = [];
let userNotifications = [];
let userTransactions = [];

/* ---------- TOAST ---------- */
function toast(title, msg, type = 'info') {
  const container = $('toastContainer');
  const icons = {
    success: 'fa-circle-check', error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation', info: 'fa-circle-info',
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(msg)}</div>
    </div>
    <button class="toast-close"><i class="fas fa-xmark"></i></button>
  `;
  container.appendChild(el);
  const remove = () => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); };
  el.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, 4500);
}

/* ---------- STATE ---------- */
function getSession() { return sessionUser?.email || null; }
function getUserData() { return userDataCache; }
function getMyInvestments() { return []; }
function getMyNotifications() { return userNotifications; }

async function loadCloudState() {
  sessionUser = await FilioBackend.currentUser();
  if (!sessionUser) {
    userDataCache = null;
    userDeposits = [];
    userWithdrawals = [];
    userNotifications = [];
    userTransactions = [];
    return false;
  }
  const [profile, deposits, withdrawals, notifications, transactions] = await Promise.all([
    FilioBackend.profile(),
    FilioBackend.myDeposits(),
    FilioBackend.myWithdrawals(),
    FilioBackend.myNotifications(),
    FilioBackend.myTransactions(),
  ]);
  userDataCache = profile;
  userDeposits = deposits;
  userWithdrawals = withdrawals;
  userNotifications = notifications;
  userTransactions = transactions;
  return true;
}

/* ---------- VALIDATION ---------- */
function isValidEmail(e) {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(e);
}
function isStrongPassword(p) {
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);
}

/* ---------- UI HELPERS ---------- */
function showError(id, msg) {
  const el = $(id); el.textContent = msg; el.classList.add('visible');
  const input = el.previousElementSibling;
  if (input && input.classList) input.classList.add('invalid');
}
function clearError(id) {
  const el = $(id); el.textContent = ''; el.classList.remove('visible');
}
function clearAllAuthErrors() {
  ['suNameErr','suEmailErr','suPassErr','suConfirmErr','liEmailErr','liPassErr'].forEach(clearError);
  document.querySelectorAll('.auth-form input').forEach(i => i.classList.remove('invalid'));
}

/* ---------- THEME & UI ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(KEYS.theme, theme);
  const icon = $('themeToggle');
  if (icon) icon.innerHTML = theme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  const sw = $('themeSwitch');
  if (sw) sw.classList.toggle('active', theme === 'dark');
}

function applyUI(ui) {
  document.documentElement.setAttribute('data-ui', ui);
  localStorage.setItem(KEYS.ui, ui);
  document.querySelectorAll('.ui-option').forEach(o => o.classList.toggle('active', o.dataset.ui === ui));
}

/* ---------- AUTH TABS ---------- */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('signupForm').classList.toggle('hidden', tab !== 'signup');
  $('loginForm').classList.toggle('hidden', tab !== 'login');
  clearAllAuthErrors();
  $('authStatus').textContent = '';
  $('authStatus').className = 'auth-status';
}
document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));
document.querySelectorAll('.switch-link').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); switchAuthTab(l.dataset.tab); });
});

/* ---------- PASSWORD EYE ---------- */
document.querySelectorAll('.toggle-eye').forEach(eye => {
  eye.addEventListener('click', () => {
    const input = $(eye.dataset.target);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    eye.classList.toggle('fa-eye', !isPass);
    eye.classList.toggle('fa-eye-slash', isPass);
  });
});

/* ---------- SIGNUP ---------- */
$('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllAuthErrors();
  const name = $('suName').value.trim();
  const email = $('suEmail').value.trim().toLowerCase();
  const pass = $('suPass').value;
  const confirm = $('suConfirm').value;
  let valid = true;

  if (name.length < 2) { showError('suNameErr', 'Please enter your full name (min 2 characters).'); valid = false; }
  if (!isValidEmail(email)) { showError('suEmailErr', 'Please enter a valid email address.'); valid = false; }
  if (!isStrongPassword(pass)) { showError('suPassErr', 'Password must be 8+ chars with uppercase, lowercase & number.'); valid = false; }
  if (pass !== confirm) { showError('suConfirmErr', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  const btn = $('signupSubmit');
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = 'Creating...';
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  try {
    const result = await FilioBackend.signUp(email, pass, name);
    if (!result.session) {
      $('authStatus').textContent = 'Account created. Check your email to confirm your address, then sign in.';
      $('authStatus').className = 'auth-status success';
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Create account';
      btn.querySelector('.btn-spinner').classList.add('hidden');
      return;
    }
    await enterApp();
  } catch (err) {
    showError('suEmailErr', err.message || 'Account creation failed. Please try again.');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Create account';
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
});

/* ---------- LOGIN ---------- */
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllAuthErrors();
  const email = $('liEmail').value.trim().toLowerCase();
  const pass = $('liPass').value;
  let valid = true;

  if (!isValidEmail(email)) { showError('liEmailErr', 'Please enter a valid email address.'); valid = false; }
  if (!pass) { showError('liPassErr', 'Please enter your password.'); valid = false; }
  if (!valid) return;

  const btn = $('loginSubmit');
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = 'Signing in...';
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  try {
    await FilioBackend.signIn(email, pass);
    await enterApp();
  } catch (err) {
    showError('liPassErr', err.message || 'Sign in failed. Please try again.');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Sign in';
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
});

/* ---------- ENTER APP ---------- */
async function enterApp() {
  const email = getSession() || (await FilioBackend.currentUser())?.email;
  if (!email) {
    $('authStatus').textContent = 'Your session expired. Please sign in again.';
    $('authStatus').className = 'auth-status error';
    return;
  }
  await loadCloudState();
  const data = getUserData();
  if (!data) throw new Error('Your profile could not be loaded. Please contact support.');

  $('authGate').classList.add('hidden');
  $('appWrapper').classList.remove('hidden');

  const initial = (data.name || email)[0].toUpperCase();
  $('sideAvatar').textContent = initial;
  $('sideName').textContent = data.name || email.split('@')[0];
  $('sideEmail').textContent = email;
  $('profileAvatar').textContent = initial;
  $('profileName').textContent = data.name || email.split('@')[0];
  $('profileEmail').textContent = email;

  $('setName').value = data.name || '';
  $('setEmail').value = email;
  $('setPhone').value = data.phone || '';
  $('setCountry').value = data.country || '';
  $('setBio').value = data.bio || '';

  refreshEverything();
  updateNotifDot();
}

/* ---------- LOGOUT ---------- */
async function logout() {
  await FilioBackend.signOut();
  sessionUser = null;
  userDataCache = null;
  userDeposits = [];
  userWithdrawals = [];
  userNotifications = [];
  $('appWrapper').classList.add('hidden');
  $('authGate').classList.remove('hidden');
  switchAuthTab('login');
  clearAllAuthErrors();
  $('authStatus').textContent = '';
  ['suName','suEmail','suPass','suConfirm','liEmail','liPass'].forEach(id => { if ($(id)) $(id).value = ''; });
  toast('Signed out', 'You have been logged out.', 'info');
}

/* ---------- PAGE NAV ---------- */
function goPage(page) {
  document.querySelectorAll('.side-nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const el = $('page-' + page);
  if (el) el.classList.remove('hidden');

  const titles = {
    dashboard: ['Dashboard', 'Welcome back'],
    plans: ['Investment plans', 'Choose a plan to grow your money'],
    investments: ['My investments', 'Track your active plans'],
    deposits: ['Deposits', 'Your deposit history'],
    settings: ['Settings', 'Manage your profile and preferences'],
  };
  const [t, s] = titles[page] || ['Dashboard', ''];
  $('pageTitle').textContent = t;
  $('pageSub').textContent = s;
}

document.querySelectorAll('.side-nav a').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); goPage(a.dataset.page); });
});
document.querySelectorAll('[data-page]').forEach(el => {
  if (el.classList.contains('side-nav')) return;
  el.addEventListener('click', e => { e.preventDefault(); goPage(el.dataset.page); });
});

/* ---------- REFRESH ---------- */
function refreshEverything() {
  const data = getUserData();
  if (!data) return;

  $('balanceDisplay').textContent = fmt(data.balance);
  $('activeEarnings').textContent = fmt(data.active_earnings);
  $('totalProfit').textContent = fmt(data.total_profit);

  const invs = getMyInvestments().filter(i => !i.cashedOut);
  $('activePlansCount').textContent = invs.length;

  renderPlans($('plansGridDash'), data, true);
  renderPlans($('plansGridFull'), data, false);
  renderActivity(data);
  renderInvestments();
  renderDeposits();
  renderWithdrawals();
  renderTransactions();
}

function renderPlans(container, data, limited) {
  if (!container) return;
  container.innerHTML = '';
  const entries = Object.entries(PLANS);
  const list = limited ? entries.slice(0, 4) : entries;

  list.forEach(([key, p]) => {
    const unlocked = (data.unlocked_plans || []).includes(key);
    const card = document.createElement('div');
    card.className = 'plan-card' + (unlocked ? '' : ' locked');
    card.innerHTML = `
      <div class="plan-name">${p.name}</div>
      <div class="plan-price">${fmt(p.price)}</div>
      <div class="plan-return">Investment purchases are temporarily paused.</div>
    `;
    container.appendChild(card);
  });
}

function renderActivity(data) {
  const container = $('activityList');
  if (!container) return;
  const notifs = getMyNotifications().slice(0, 5);
  if (!notifs.length) {
    container.innerHTML = `<div class="empty-state">No activity yet</div>`;
    return;
  }
  container.innerHTML = notifs.map(n => `
    <div class="activity-item">
      <div class="activity-icon"><i class="fas ${escapeHtml(n.icon)}"></i></div>
      <div class="activity-text">
        <div>${escapeHtml(n.text)}</div>
        <div class="activity-time">${timeAgo(n.created_at)}</div>
      </div>
    </div>
  `).join('');
}

function renderInvestments() {
  const container = $('investmentsList');
  if (!container) return;
  const list = getMyInvestments();
  if (!list.length) {
    container.innerHTML = `<div class="empty-state">Investment purchases are temporarily unavailable while secure settlement is configured.</div>`;
    return;
  }
  const now = Date.now();
  container.innerHTML = list.map(inv => {
    const pct = Math.min(100, ((now - inv.start) / (inv.end - inv.start)) * 100);
    const matured = now >= inv.end;
    const elapsedMs = Math.min(now - inv.start, inv.end - inv.start);
    const earned = (inv.returnAmt - inv.totalInvested) * (elapsedMs / (inv.end - inv.start));
    const daysLeft = Math.max(0, Math.ceil((inv.end - now) / (24 * 60 * 60 * 1000)));
    return `
      <div class="investment-item">
        <div class="inv-top">
          <span>${PLANS[inv.plan].name} Plan ×${inv.qty}</span>
          <span class="inv-pct">${matured ? 'Matured ✓' : pct.toFixed(1) + '%'}</span>
        </div>
        <div class="inv-bar"><div class="inv-bar-fill" style="width:${pct}%"></div></div>
        <div class="inv-amounts">
          <div><span>Invested</span><strong>${fmt(inv.totalInvested)}</strong></div>
          <div><span>Earned so far</span><strong>${fmt(earned)}</strong></div>
          <div><span>Target</span><strong>${fmt(inv.returnAmt)}</strong></div>
        </div>
        <div class="inv-meta">
          <span>${matured ? 'Completed' : daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' left'}</span>
          ${matured && !inv.cashedOut
            ? `<button class="btn-small" onclick="cashOut(${inv.id})">Cash out ${fmt(inv.returnAmt)}</button>`
            : inv.cashedOut
              ? `<span style="color:var(--success);font-weight:600;">Cashed out</span>`
              : `<span>Ends ${new Date(inv.end).toLocaleDateString()}</span>`}
        </div>
      </div>
    `;
  }).join('');
}

function renderDeposits() {
  const container = $('depositsList');
  if (!container) return;
  const mine = userDeposits;
  if (!mine.length) {
    container.innerHTML = `<div class="empty-state">No deposits yet.</div>`;
    return;
  }
  container.innerHTML = mine.map(p => `
    <div class="investment-item">
      <div class="inv-top">
        <span>${PLANS[p.plan].name} ×${p.quantity}</span>
        <span style="color:${p.status === 'approved' ? 'var(--success)' : p.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'};text-transform:capitalize;font-weight:600;">${p.status}</span>
      </div>
      <div class="inv-meta">
        <span>${fmt(p.amount)}</span>
        <span>${new Date(p.created_at).toLocaleString()}</span>
      </div>
    </div>
  `).join('');
}

function renderWithdrawals() {
  const container = $('withdrawalsList');
  if (!container) return;
  if (!userWithdrawals.length) {
    container.innerHTML = `<div class="empty-state">No withdrawals yet.</div>`;
    return;
  }
  container.innerHTML = userWithdrawals.map(request => `
    <div class="investment-item">
      <div class="inv-top">
        <span>${fmt(request.amount)}</span>
        <span style="color:${request.status === 'paid' ? 'var(--success)' : request.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'};text-transform:capitalize;font-weight:600;">${escapeHtml(request.status)}</span>
      </div>
      <div class="inv-meta">
        <span>${escapeHtml(request.bank_name)} · Account ending ${escapeHtml(request.account_number.slice(-4))}</span>
        <span>${new Date(request.created_at).toLocaleString()}</span>
      </div>
    </div>
  `).join('');
}

function renderTransactions() {
  const container = $('transactionsList');
  if (!container) return;
  if (!userTransactions.length) {
    container.innerHTML = '<div class="empty-state">No wallet transactions yet.</div>';
    return;
  }
  container.innerHTML = userTransactions.map(transaction => {
    const amount = Number(transaction.amount);
    const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
    const color = amount > 0 ? 'var(--success)' : amount < 0 ? 'var(--warning)' : 'var(--text-muted)';
    return `
      <div class="investment-item">
        <div class="inv-top">
          <span>${escapeHtml(transaction.reason)}</span>
          <strong style="color:${color}">${sign}${fmt(Math.abs(amount))}</strong>
        </div>
        <div class="inv-meta">
          <span>${escapeHtml(transaction.transaction_type.replaceAll('_', ' '))}</span>
          <span>${new Date(transaction.created_at).toLocaleString()}</span>
        </div>
      </div>
    `;
  }).join('');
}

function timeAgo(t) {
  const timestamp = new Date(t).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const s = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

/* ---------- BUY ---------- */
let pendingBuyPlan = null;
function openBuyModal(planKey) {
  pendingBuyPlan = planKey;
  const p = PLANS[planKey];
  $('buyBody').textContent = `${p.name} purchases are temporarily unavailable while secure investment settlement is configured. No funds will be charged.`;
  $('buyModal').classList.add('active');
}

function buyPlan(planKey) {
  toast('Purchases unavailable', 'Investment purchases are disabled until server-side settlement is implemented.', 'warning');
}

window.cashOut = function(invId) {
  toast('Cash out unavailable', 'Investment cash-outs must be processed by the secure server ledger.', 'warning');
};

/* ---------- DEPOSIT ---------- */
let depositState = { plan:null, qty:1, receiptFile:null };

function openDepositModal() {
  depositState = { plan:null, qty:1, receiptFile:null };
  $('depositStep1').classList.remove('hidden');
  $('depositStep2').classList.add('hidden');
  renderPlanSelector();
  updateDepositTotal();
  $('modalStatus').textContent = '';
  $('receiptPreview').classList.add('hidden');
  $('receiptPlaceholder').classList.remove('hidden');
  $('receiptInput').value = '';
  $('submitReceiptBtn').disabled = true;
  $('uploadStatus').textContent = '';
  $('depositModal').classList.add('active');
}

function renderPlanSelector() {
  const sel = $('planSelector');
  sel.innerHTML = Object.entries(PLANS).map(([k,p]) => `
    <div class="plan-option" data-plan="${k}">${p.name}<br><small>${fmt(p.price)}</small></div>
  `).join('');
  sel.querySelectorAll('.plan-option').forEach(el => {
    el.addEventListener('click', () => {
      sel.querySelectorAll('.plan-option').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      depositState.plan = el.dataset.plan;
      updateDepositTotal();
    });
  });
}

function updateDepositTotal() {
  const plan = depositState.plan ? PLANS[depositState.plan] : null;
  const total = plan ? plan.price * depositState.qty : 0;
  $('qtyDisplay').textContent = depositState.qty;
  $('totalAmount').textContent = fmt(total);
}

/* ---------- RECEIPT VALIDATION ---------- */
function looksLikeReceipt(file) {
  if (!file.type.startsWith('image/')) return false;
  if (file.size > 5 * 1024 * 1024) return false;
  if (file.size < 10 * 1024) return false;
  return true;
}
function validateReceiptImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < 200 || img.height < 200) { resolve(false); return; }
      const ratio = img.width / img.height;
      if (ratio > 5 || ratio < 0.2) { resolve(false); return; }
      resolve(true);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

/* ---------- NOTIFICATIONS PANEL ---------- */
function updateNotifDot() {
  const notifs = getMyNotifications();
  const unread = notifs.filter(n => !n.read).length;
  $('notifDot').classList.toggle('hidden', unread === 0);
}

async function openNotifPanel() {
  const notifs = getMyNotifications().slice().reverse();
  $('notifList').innerHTML = notifs.length
    ? notifs.map(n => `
        <div class="notif-item">
          <i class="fas ${escapeHtml(n.icon)}"></i>
          <div>
            <div>${escapeHtml(n.text)}</div>
            <div class="notif-time">${timeAgo(n.created_at)}</div>
          </div>
        </div>`).join('')
    : `<div class="empty-state">No notifications</div>`;
  try {
    await FilioBackend.markNotificationsRead();
    userNotifications = userNotifications.map(n => ({ ...n, read: true }));
  } catch (error) {
    toast('Notifications not updated', error.message, 'error');
  }
  updateNotifDot();
  $('notifPanel').classList.add('open');
  $('notifBackdrop').classList.remove('hidden');
}
function closeNotifPanel() {
  $('notifPanel').classList.remove('open');
  $('notifBackdrop').classList.add('hidden');
}

/* ============================================================
   EVENT BINDINGS
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(localStorage.getItem(KEYS.theme) || 'dark');
  applyUI(localStorage.getItem(KEYS.ui) || 'classic');

  try {
    if (await loadCloudState()) await enterApp();
    else {
      $('authGate').classList.remove('hidden');
      $('appWrapper').classList.add('hidden');
    }
  } catch (error) {
    $('authGate').classList.remove('hidden');
    $('appWrapper').classList.add('hidden');
    $('authStatus').textContent = `Could not connect to the account service: ${error.message}`;
    $('authStatus').className = 'auth-status error';
  }

  $('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
  $('themeSwitch').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
  document.querySelectorAll('.ui-option').forEach(o => {
    o.addEventListener('click', () => {
      applyUI(o.dataset.ui);
      toast('UI style changed', `Switched to ${o.dataset.ui} theme.`, 'info');
    });
  });

  const handleLogout = () => logout().catch(error => toast('Sign out failed', error.message, 'error'));
  $('logoutBtnTop').addEventListener('click', handleLogout);
  $('logoutBtnSettings').addEventListener('click', handleLogout);

  $('notifBtn').addEventListener('click', openNotifPanel);
  $('closeNotif').addEventListener('click', closeNotifPanel);
  $('notifBackdrop').addEventListener('click', closeNotifPanel);

  $('depositBtn').addEventListener('click', openDepositModal);
  $('withdrawBtn').addEventListener('click', () => {
    $('withdrawModal').classList.add('active');
    $('withdrawStatus').textContent = '';
    $('withdrawAmount').value = '';
    $('withdrawAccountName').value = '';
    $('withdrawBankName').value = '';
    $('withdrawAccountNumber').value = '';
  });

  $('closeDeposit').addEventListener('click', () => $('depositModal').classList.remove('active'));
  $('cancelDeposit').addEventListener('click', () => $('depositModal').classList.remove('active'));
  $('qtyMinus').addEventListener('click', () => { if (depositState.qty > 1) { depositState.qty--; updateDepositTotal(); } });
  $('qtyPlus').addEventListener('click', () => { depositState.qty++; updateDepositTotal(); });

  $('confirmDeposit').addEventListener('click', () => {
    if (!depositState.plan) { $('modalStatus').textContent = 'Please select a plan first.'; $('modalStatus').className = 'status-message error'; return; }
    $('modalStatus').textContent = '';
    $('depositStep1').classList.add('hidden');
    $('depositStep2').classList.remove('hidden');
  });
  $('backDeposit').addEventListener('click', () => {
    $('depositStep2').classList.add('hidden');
    $('depositStep1').classList.remove('hidden');
  });

  $('receiptZone').addEventListener('click', (e) => {
    if (e.target.closest('.receipt-remove')) return;
    $('receiptInput').click();
  });
  $('receiptRemove').addEventListener('click', (e) => {
    e.stopPropagation();
    depositState.receiptFile = null;
    $('receiptPreview').classList.add('hidden');
    $('receiptPlaceholder').classList.remove('hidden');
    $('receiptInput').value = '';
    $('submitReceiptBtn').disabled = true;
    $('uploadStatus').textContent = '';
  });
  $('receiptInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $('uploadStatus').textContent = 'Validating receipt...';
    $('uploadStatus').className = 'status-message';

    if (!looksLikeReceipt(file)) {
      $('uploadStatus').textContent = 'Invalid file. Please upload a real bank receipt image (max 5MB).';
      $('uploadStatus').className = 'status-message error';
      e.target.value = '';
      return;
    }
    const valid = await validateReceiptImage(file);
    if (!valid) {
      $('uploadStatus').textContent = 'This image does not look like a bank receipt. Please upload a clear screenshot.';
      $('uploadStatus').className = 'status-message error';
      e.target.value = '';
      return;
    }
    depositState.receiptFile = file;
    const url = URL.createObjectURL(file);
    $('receiptImg').src = url;
    $('receiptPlaceholder').classList.add('hidden');
    $('receiptPreview').classList.remove('hidden');
    $('submitReceiptBtn').disabled = false;
    $('uploadStatus').textContent = 'Receipt looks good. Submit for approval.';
    $('uploadStatus').className = 'status-message success';
  });

  $('submitReceiptBtn').addEventListener('click', () => {
    if (!depositState.receiptFile) return;
    if (!depositState.plan) return;
    const email = getSession();
    if (!email) { logout(); return; }

    $('submitReceiptBtn').disabled = true;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await FilioBackend.requestDeposit({
          plan: depositState.plan,
          quantity: depositState.qty,
          receiptName: depositState.receiptFile.name,
          receiptData: reader.result,
        });
        await loadCloudState();
        $('depositModal').classList.remove('active');
        toast('Receipt submitted', 'Your deposit is under review. You will be notified once approved.', 'success');
        refreshEverything();
      } catch (error) {
        $('uploadStatus').textContent = error.message || 'Could not submit the receipt. Please try again.';
        $('uploadStatus').className = 'status-message error';
        $('submitReceiptBtn').disabled = false;
      }
    };
    reader.onerror = () => {
      $('uploadStatus').textContent = 'Could not read the receipt file. Please choose it again.';
      $('uploadStatus').className = 'status-message error';
      $('submitReceiptBtn').disabled = false;
    };
    reader.readAsDataURL(depositState.receiptFile);
  });

  $('cancelBuy').addEventListener('click', () => $('buyModal').classList.remove('active'));
  $('closeBuy').addEventListener('click', () => $('buyModal').classList.remove('active'));
  $('confirmBuy').addEventListener('click', () => {
    const p = pendingBuyPlan;
    $('buyModal').classList.remove('active');
    if (p) buyPlan(p);
  });

  $('closeWithdraw').addEventListener('click', () => $('withdrawModal').classList.remove('active'));
  $('cancelWithdraw').addEventListener('click', () => $('withdrawModal').classList.remove('active'));
  $('confirmWithdraw').addEventListener('click', async () => {
    const data = getUserData();
    const email = getSession();
    if (!data || !email) return;
    const amt = Number($('withdrawAmount').value);
    const accountName = $('withdrawAccountName').value.trim();
    const bankName = $('withdrawBankName').value.trim();
    const accountNumber = $('withdrawAccountNumber').value.trim();
    if (!Number.isFinite(amt) || !Number.isInteger(amt) || amt < 5000) { $('withdrawStatus').textContent = 'Enter a whole-number amount of at least ₦5,000.'; $('withdrawStatus').className = 'status-message error'; return; }
    if (accountName.length < 2 || !bankName || !/^\d{10}$/.test(accountNumber)) {
      $('withdrawStatus').textContent = 'Enter the account name, bank name, and a valid 10-digit account number.';
      $('withdrawStatus').className = 'status-message error';
      return;
    }

    const button = $('confirmWithdraw');
    button.disabled = true;
    try {
      await FilioBackend.requestWithdrawal({ amount: amt, accountName, bankName, accountNumber });
      await loadCloudState();
      refreshEverything();
      $('withdrawModal').classList.remove('active');
      toast('Withdrawal submitted', 'Your request is awaiting admin review.', 'success');
    } catch (error) {
      $('withdrawStatus').textContent = error.message || 'Could not submit the withdrawal. Please try again.';
      $('withdrawStatus').className = 'status-message error';
    } finally {
      button.disabled = false;
    }
  });

  $('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!getUserData()) return;
    const name = $('setName').value.trim();
    if (name.length < 2) { toast('Invalid name', 'Please enter at least 2 characters.', 'error'); return; }
    try {
      userDataCache = await FilioBackend.updateProfile({
        name,
        phone: $('setPhone').value.trim(),
        country: $('setCountry').value.trim(),
        bio: $('setBio').value.trim(),
      });
      await enterApp();
      toast('Profile updated', 'Your profile has been saved.', 'success');
    } catch (error) {
      toast('Profile not updated', error.message || 'Please try again.', 'error');
    }
  });

  $('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = getSession();
    if (!email) return;
    const cur = $('curPass').value;
    const nw = $('newPass').value;
    const cf = $('confPass').value;
    if (!isStrongPassword(nw)) { toast('Weak password', 'New password must be 8+ chars with uppercase, lowercase & number.', 'error'); return; }
    if (nw !== cf) { toast('Password mismatch', 'New passwords do not match.', 'error'); return; }
    try {
      await FilioBackend.changePassword(email, cur, nw);
      $('curPass').value = '';
      $('newPass').value = '';
      $('confPass').value = '';
      toast('Password updated', 'Your password has been changed successfully.', 'success');
    } catch (error) {
      toast('Password not updated', error.message || 'Check your current password and try again.', 'error');
    }
  });

  setInterval(async () => {
    if (!getSession()) return;
    try {
      await loadCloudState();
      refreshEverything();
    } catch (error) {
      console.error('Could not refresh account data.', error);
    }
  }, 15000);
});