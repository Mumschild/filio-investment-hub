const $ = id => document.getElementById(id);
const fmt = amount => '₦' + Number(amount || 0).toLocaleString('en-NG');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

let deposits = [];
let withdrawals = [];
let walletCreditEmail = null;

function toast(title, message, type = 'info') {
  const container = $('toastContainer');
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" type="button" aria-label="Dismiss"><i class="fas fa-xmark"></i></button>
  `;
  container.appendChild(el);
  const remove = () => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); };
  el.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, 4500);
}

function showDashboard() {
  $('loginScreen').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
}

function showLogin() {
  $('dashboard').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');
}

async function refreshAll() {
  const [depositRows, withdrawalRows, users] = await Promise.all([
    FilioBackend.adminDeposits(),
    FilioBackend.adminWithdrawals(),
    FilioBackend.adminUsers(),
  ]);
  deposits = depositRows;
  withdrawals = withdrawalRows;
  $('statPending').textContent = deposits.length;
  $('statWithdrawals').textContent = withdrawals.length;
  $('statUsers').textContent = users.length;
  renderDeposits();
  renderWithdrawals();
  renderUsers(users);
}

function renderDeposits() {
  const container = $('pendingList');
  if (!deposits.length) {
    container.innerHTML = '<div class="empty-state">No pending deposits.</div>';
    return;
  }
  container.innerHTML = deposits.map(deposit => {
    const safeId = escapeHtml(deposit.id);
    const receipt = typeof deposit.receipt_data === 'string' && deposit.receipt_data.startsWith('data:image/')
      ? `<img src="${escapeHtml(deposit.receipt_data)}" class="receipt-thumb" data-receipt-id="${safeId}" alt="Deposit receipt">`
      : '<span>Receipt image unavailable.</span>';
    return `
      <div class="approval-item">
        <div class="approval-header">
          <span class="user-email">${escapeHtml(deposit.name)} · ${escapeHtml(deposit.email)}</span>
          <span class="amount">${fmt(deposit.amount)}</span>
        </div>
        <div class="receipt-meta">
          <span><i class="fas fa-layer-group"></i>${escapeHtml(deposit.plan)} ×${Number(deposit.quantity)}</span>
          <span><i class="fas fa-file"></i>${escapeHtml(deposit.receipt_name)}</span>
          <span><i class="fas fa-clock"></i>${new Date(deposit.created_at).toLocaleString()}</span>
        </div>
        <div class="receipt-row">${receipt}</div>
        <div class="approval-actions">
          <button class="btn-small btn-approve" type="button" data-action="approve-deposit" data-id="${safeId}"><i class="fas fa-check"></i> Approve</button>
          <button class="btn-small btn-reject" type="button" data-action="reject-deposit" data-id="${safeId}"><i class="fas fa-times"></i> Reject</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderWithdrawals() {
  const container = $('withdrawalList');
  if (!withdrawals.length) {
    container.innerHTML = '<div class="empty-state">No pending withdrawal requests.</div>';
    return;
  }
  container.innerHTML = withdrawals.map(request => `
    <div class="approval-item">
      <div class="approval-header">
        <span class="user-email">${escapeHtml(request.name)} · ${escapeHtml(request.email)}</span>
        <span class="amount">${fmt(request.amount)}</span>
      </div>
      <div class="receipt-meta">
        <span><i class="fas fa-building-columns"></i>Bank: ${escapeHtml(request.bank_name)}</span>
        <span><i class="fas fa-user"></i>Account name: ${escapeHtml(request.account_name)}</span>
        <span><i class="fas fa-hashtag"></i>Account number: ${escapeHtml(request.account_number)}</span>
        <span><i class="fas fa-clock"></i>${new Date(request.created_at).toLocaleString()}</span>
      </div>
      <div class="approval-actions">
        <button class="btn-small btn-approve" type="button" data-action="mark-withdrawal-paid" data-id="${escapeHtml(request.id)}"><i class="fas fa-check"></i> Mark as paid</button>
        <button class="btn-small btn-reject" type="button" data-action="reject-withdrawal" data-id="${escapeHtml(request.id)}"><i class="fas fa-times"></i> Reject &amp; refund</button>
      </div>
    </div>
  `).join('');
}

function renderUsers(users) {
  const container = $('usersList');
  if (!users.length) {
    container.innerHTML = '<div class="empty-state">No registered users yet.</div>';
    return;
  }
  container.innerHTML = users.map(user => `
    <div class="user-row">
      <div>
        <div class="email">${escapeHtml(user.name || user.email.split('@')[0])}</div>
        <div class="user-email-sub">${escapeHtml(user.email)}</div>
      </div>
      <span class="balance">${fmt(user.balance)}</span>
      <button type="button" class="btn-small btn-approve" data-credit-user="${escapeHtml(user.email)}">
        <i class="fas fa-wallet"></i> Credit wallet
      </button>
    </div>
  `).join('');
}

async function runAdminAction(action, id) {
  try {
    if (action === 'approve-deposit') await FilioBackend.adminApproveDeposit(id);
    else if (action === 'reject-deposit') await FilioBackend.adminRejectDeposit(id);
    else if (action === 'mark-withdrawal-paid') await FilioBackend.adminMarkWithdrawalPaid(id);
    else if (action === 'reject-withdrawal') await FilioBackend.adminRejectWithdrawal(id);
    else return;
    await refreshAll();
    toast('Request updated', 'The user wallet and request status were updated.', 'success');
  } catch (error) {
    toast('Action failed', error.message || 'Please refresh and try again.', 'error');
  }
}

document.querySelectorAll('.sidebar nav a').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    document.querySelectorAll('.sidebar nav a').forEach(item => item.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    const tab = $('tab-' + link.dataset.tab);
    if (tab) tab.classList.remove('hidden');
    $('pageTitle').textContent = link.textContent.trim();
  });
});

$('loginBtn').addEventListener('click', async () => {
  const email = $('adminEmail').value.trim().toLowerCase();
  const password = $('adminPass').value;
  const button = $('loginBtn');
  button.disabled = true;
  $('loginError').classList.remove('visible');
  try {
    await FilioBackend.signIn(email, password);
    if (!(await FilioBackend.isAdmin())) {
      await FilioBackend.signOut();
      throw new Error('This account does not have admin access.');
    }
    showDashboard();
    await refreshAll();
    toast('Welcome', 'Admin dashboard loaded.', 'success');
  } catch (error) {
    $('loginError').textContent = error.message || 'Sign in failed.';
    $('loginError').classList.add('visible');
  } finally {
    button.disabled = false;
  }
});

$('logoutBtn').addEventListener('click', async () => {
  try {
    await FilioBackend.signOut();
    $('adminEmail').value = '';
    $('adminPass').value = '';
    showLogin();
  } catch (error) {
    toast('Sign out failed', error.message, 'error');
  }
});

$('pendingList').addEventListener('click', event => {
  const image = event.target.closest('[data-receipt-id]');
  if (image) {
    const deposit = deposits.find(item => item.id === image.dataset.receiptId);
    if (deposit && deposit.receipt_data?.startsWith('data:image/')) {
      $('receiptFullImg').src = deposit.receipt_data;
      $('receiptModal').classList.add('active');
    }
    return;
  }
  const button = event.target.closest('[data-action]');
  if (button) runAdminAction(button.dataset.action, button.dataset.id);
});

$('withdrawalList').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) runAdminAction(button.dataset.action, button.dataset.id);
});

$('closeReceipt').addEventListener('click', () => {
  $('receiptModal').classList.remove('active');
  $('receiptFullImg').removeAttribute('src');
});

$('usersList').addEventListener('click', event => {
  const button = event.target.closest('[data-credit-user]');
  if (!button) return;
  walletCreditEmail = button.dataset.creditUser;
  $('walletCreditUser').textContent = walletCreditEmail;
  $('walletCreditAmount').value = '';
  $('walletCreditReason').value = '';
  $('walletCreditError').textContent = '';
  $('walletCreditModal').classList.add('active');
});

function closeWalletCreditModal() {
  $('walletCreditModal').classList.remove('active');
  walletCreditEmail = null;
}

$('closeWalletCredit').addEventListener('click', closeWalletCreditModal);
$('cancelWalletCredit').addEventListener('click', closeWalletCreditModal);
$('walletCreditForm').addEventListener('submit', async event => {
  event.preventDefault();
  const amount = Number($('walletCreditAmount').value);
  const reason = $('walletCreditReason').value.trim();
  const error = $('walletCreditError');
  if (!walletCreditEmail) {
    error.textContent = 'Select a user before crediting a wallet.';
    return;
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    error.textContent = 'Enter a whole-number amount greater than zero.';
    return;
  }
  if (reason.length < 3) {
    error.textContent = 'Enter a reason (at least 3 characters).';
    return;
  }
  const email = walletCreditEmail;
  const submit = $('walletCreditForm').querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await FilioBackend.adminCreditWallet(email, amount, reason);
    closeWalletCreditModal();
    await refreshAll();
    toast('Wallet credited', `${fmt(amount)} added to ${email}.`, 'success');
  } catch (err) {
    error.textContent = err.message || 'Wallet credit failed. Please try again.';
  } finally {
    submit.disabled = false;
  }
});

async function restoreAdminSession() {
  try {
    if (await FilioBackend.currentUser()) {
      if (await FilioBackend.isAdmin()) {
        showDashboard();
        await refreshAll();
      } else {
        await FilioBackend.signOut();
        showLogin();
      }
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
    toast('Admin data unavailable', error.message || 'Could not connect to Supabase.', 'error');
  }
}

restoreAdminSession();
setInterval(async () => {
  if ($('dashboard').classList.contains('hidden')) return;
  try {
    await refreshAll();
  } catch (error) {
    console.error('Could not refresh the admin dashboard.', error);
  }
}, 15000);
