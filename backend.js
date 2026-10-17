(() => {
  const config = window.FILIO_SUPABASE_CONFIG;
  if (!config || !config.url || !config.publishableKey || !window.supabase) {
    throw new Error('Supabase is not configured. Check backend-config.js and the Supabase client script.');
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);

  async function unwrap(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async function currentUser() {
    const { data, error } = await client.auth.getUser();
    if (error && error.message !== 'Auth session missing!') throw new Error(error.message);
    return data.user;
  }

  window.FilioBackend = {
    signUp(email, password, name) {
      return unwrap(client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: new URL('.', window.location.href).toString(),
        },
      }));
    },

    signIn(email, password) {
      return unwrap(client.auth.signInWithPassword({ email, password }));
    },

    signOut() {
      return unwrap(client.auth.signOut());
    },

    async currentUser() {
      return currentUser();
    },

    async profile() {
      const user = await currentUser();
      if (!user) return null;
      return unwrap(client.from('profiles')
        .select('id,email,name,phone,country,bio,balance,total_profit,active_earnings,unlocked_plans,created_at')
        .eq('id', user.id)
        .single());
    },

    async updateProfile(profile) {
      const user = await currentUser();
      if (!user) throw new Error('You must sign in again to update your profile.');
      return unwrap(client.from('profiles')
        .update({
          name: profile.name,
          phone: profile.phone,
          country: profile.country,
          bio: profile.bio,
        })
        .eq('id', user.id)
        .select('id,email,name,phone,country,bio,balance,total_profit,active_earnings,unlocked_plans,created_at')
        .single());
    },

    async changePassword(email, currentPassword, newPassword) {
      await unwrap(client.auth.signInWithPassword({ email, password: currentPassword }));
      return unwrap(client.auth.updateUser({ password: newPassword }));
    },

    async isAdmin() {
      return unwrap(client.rpc('is_admin'));
    },

    async requestWithdrawal(request) {
      return unwrap(client.rpc('request_withdrawal', {
        p_amount: request.amount,
        p_account_name: request.accountName,
        p_bank_name: request.bankName,
        p_account_number: request.accountNumber,
      }));
    },

    async requestDeposit(request) {
      return unwrap(client.rpc('request_deposit', {
        p_plan: request.plan,
        p_quantity: request.quantity,
        p_receipt_name: request.receiptName,
        p_receipt_data: request.receiptData,
      }));
    },

    async myWithdrawals() {
      return unwrap(client.from('withdrawal_requests')
        .select('id,amount,status,created_at,processed_at,bank_name,account_name,account_number')
        .order('created_at', { ascending: false }));
    },

    async myDeposits() {
      return unwrap(client.from('deposit_requests')
        .select('id,plan,quantity,amount,status,created_at')
        .order('created_at', { ascending: false }));
    },

    async myNotifications() {
      return unwrap(client.from('notifications')
        .select('id,icon,text,created_at,read')
        .order('created_at', { ascending: false })
        .limit(100));
    },

    async myTransactions() {
      return unwrap(client.from('wallet_transactions')
        .select('id,transaction_type,amount,reason,created_at')
        .order('created_at', { ascending: false })
        .limit(100));
    },

    async markNotificationsRead() {
      const user = await currentUser();
      if (!user) throw new Error('You must sign in again to update notifications.');
      return unwrap(client.from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false));
    },

    async adminWithdrawals() {
      return unwrap(client.rpc('admin_list_withdrawals'));
    },

    async adminDeposits() {
      return unwrap(client.rpc('admin_list_deposits'));
    },

    async adminUsers() {
      return unwrap(client.rpc('admin_list_users'));
    },

    async adminCreditWallet(email, amount, reason) {
      return unwrap(client.rpc('admin_credit_wallet', {
        p_email: email,
        p_amount: amount,
        p_reason: reason,
      }));
    },

    async adminMarkWithdrawalPaid(id) {
      return unwrap(client.rpc('admin_mark_withdrawal_paid', { p_withdrawal_id: id }));
    },

    async adminRejectWithdrawal(id) {
      return unwrap(client.rpc('admin_reject_withdrawal', { p_withdrawal_id: id }));
    },

    async adminApproveDeposit(id) {
      return unwrap(client.rpc('admin_approve_deposit', { p_deposit_id: id }));
    },

    async adminRejectDeposit(id) {
      return unwrap(client.rpc('admin_reject_deposit', { p_deposit_id: id }));
    },
  };
})();
