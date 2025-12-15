# Supabase Setup Guide
## Hedge Payments + Bankroll Database

This guide will walk you through setting up Supabase for the Hedge Payments / Bankroll network-aware payment system.

---

## Why Supabase?

✅ **PostgreSQL** - Reliable ACID transactions for financial data
✅ **Real-time** - Instant wallet balance updates
✅ **Built-in Auth** - User authentication out of the box
✅ **Row Level Security** - Users can only see their own data
✅ **Auto APIs** - REST and GraphQL endpoints automatically
✅ **Free Tier** - 500MB database, 2GB file storage, 50GB bandwidth

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up / Log in
3. Click "New Project"
4. Fill in:
   - **Name:** `hedge-payments` (or your choice)
   - **Database Password:** Generate a strong password (save it!)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free (for development)

5. Wait ~2 minutes for project to provision

---

## Step 2: Get Your Credentials

In your Supabase dashboard:

1. Go to **Settings** → **API**
2. Copy these values:

   ```bash
   Project URL: https://xxxxx.supabase.co
   anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Add to your `.env` file:

   ```bash
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

⚠️ **Important:** Use `service_role` key for backend (it bypasses RLS). NEVER expose it in client code!

---

## Step 3: Run Database Migrations

### Option A: Via Supabase Dashboard (Easiest)

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and click **Run**
5. Repeat for `supabase/migrations/002_transfer_function.sql`

### Option B: Via Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref xxxxx

# Run migrations
supabase db push
```

---

## Step 4: Verify Schema

In SQL Editor, run:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should see:
-- users
-- merchants
-- wallets
-- wallet_balances
-- transactions
-- ledger_entries
-- payment_methods
-- network_analytics
```

---

## Step 5: Install Dependencies

```bash
cd /Users/jacksonfitzgerald/Documents/hedge-payments-api
npm install
```

This will install `@supabase/supabase-js` and all other dependencies.

---

## Step 6: Test Connection

Create a test file `test-supabase.js`:

```javascript
require('dotenv').config();
const { supabase, db } = require('./src/config/supabase');

async function test() {
  console.log('Testing Supabase connection...\n');

  // Test 1: Connection
  const { data, error } = await supabase
    .from('users')
    .select('count')
    .limit(1);

  if (error) {
    console.error('❌ Connection failed:', error.message);
    return;
  }

  console.log('✅ Connection successful!\n');

  // Test 2: Create test user
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email: 'test@example.com',
      username: 'testuser',
      display_name: 'Test User',
      type: 'consumer'
    })
    .select()
    .single();

  if (userError) {
    console.error('❌ User creation failed:', userError.message);
    return;
  }

  console.log('✅ User created:', user.id);

  // Test 3: Create wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .insert({
      user_id: user.id,
      type: 'consumer'
    })
    .select()
    .single();

  console.log('✅ Wallet created:', wallet.id);

  // Test 4: Create balance
  const { data: balance } = await supabase
    .from('wallet_balances')
    .insert({
      wallet_id: wallet.id,
      currency: 'USD',
      available_balance: 1000
    })
    .select()
    .single();

  console.log('✅ Balance created: $1000\n');

  // Cleanup
  await supabase.from('users').delete().eq('id', user.id);
  console.log('✅ Test complete! (cleaned up test data)');
}

test().catch(console.error);
```

Run:

```bash
node test-supabase.js
```

Expected output:
```
Testing Supabase connection...

✅ Connection successful!
✅ User created: 550e8400-e29b-41d4-a716-446655440000
✅ Wallet created: 660f9500-f39c-51e5-b827-557766551111
✅ Balance created: $1000

✅ Test complete! (cleaned up test data)
```

---

## Step 7: Integrate with Agents

The agents are already configured to use Supabase! Just make sure your `.env` has the credentials.

### Test Agent Integration

```bash
node examples/test-agents.js
```

This will:
1. Initialize the orchestrator with Supabase connection
2. Test network detection (will actually query database)
3. Test transfer quotes
4. Show system metrics

---

## Database Schema Overview

### Key Tables

**users**
- All Bankroll users and Hedge merchants
- Email, phone, username
- KYC status

**wallets**
- One per user (can have multiple currencies)
- Links to users table
- Solana address for crypto

**wallet_balances**
- Available, pending, reserved balances
- One row per wallet per currency
- Updated atomically during transfers

**transactions**
- All payment transactions
- Tracks fee, cost, **profit** (key metric!)
- Internal transfers have cost=0, external have cost>0

**ledger_entries**
- Double-entry accounting
- Every transaction creates 2+ entries
- Audit trail with balance snapshots

**merchants**
- Business information
- Domain, location, category
- Tracks `uses_hedge_payments` flag

**network_analytics**
- Daily aggregated metrics
- Tracks internal vs external volume
- Monitors network effect growth

---

## Important SQL Functions

### `execute_internal_transfer()`

Atomically execute internal network transfers:

```sql
SELECT execute_internal_transfer(
  p_from_wallet_id := 'uuid-here',
  p_to_wallet_id := 'uuid-here',
  p_amount := 100.00,
  p_currency := 'USD',
  p_fee := 1.00,
  p_memo := 'Payment for services'
);
```

Returns transaction details as JSON.

**Features:**
- Atomic (all-or-nothing)
- Balance validation
- Double-entry bookkeeping
- Zero cost, 100% profit tracking

### `aggregate_daily_analytics()`

Generate daily network metrics:

```sql
SELECT aggregate_daily_analytics(CURRENT_DATE);
```

Run this nightly (via cron or Supabase scheduled function).

---

## Row Level Security (RLS)

RLS is **enabled** on user-facing tables. This means:

✅ Users can only see their own data
✅ Can't see other users' wallets
✅ Can't see other users' transactions

**Backend service** uses `service_role` key which bypasses RLS.

### Example RLS Policy

```sql
-- Users can only see their own transactions
CREATE POLICY transactions_select_involved ON transactions
  FOR SELECT USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );
```

To view RLS policies:

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

---

## Real-Time Subscriptions

Supabase provides real-time updates! Perfect for Bankroll app.

### Example: Listen to Balance Changes

```javascript
// In Bankroll iOS app
const channel = supabase
  .channel('wallet-changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'wallet_balances',
      filter: `wallet_id=eq.${userWalletId}`
    },
    (payload) => {
      console.log('Balance updated!', payload.new.available_balance);
      // Update UI immediately
    }
  )
  .subscribe();
```

### Example: Listen to Incoming Transactions

```javascript
const channel = supabase
  .channel('incoming-payments')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'transactions',
      filter: `to_user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Payment received!', payload.new.amount);
      // Show notification
    }
  )
  .subscribe();
```

---

## Sample Queries

### Get User's Wallet Balance

```javascript
const { data } = await supabase
  .from('user_wallet_summary')
  .select('*')
  .eq('user_id', userId)
  .single();

console.log(`Balance: $${data.available_balance}`);
```

### Get Transaction History

```javascript
const { data } = await supabase
  .from('transactions')
  .select(`
    *,
    from_user:users!from_user_id(username, display_name),
    to_user:users!to_user_id(username, display_name)
  `)
  .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
  .order('created_at', { ascending: false })
  .limit(50);
```

### Get Network Merchants

```javascript
const { data } = await supabase
  .from('merchants')
  .select('*')
  .eq('uses_hedge_payments', true)
  .eq('city', 'San Francisco')
  .order('bankroll_users_count', { ascending: false });
```

### Get Network Analytics

```javascript
const { data } = await supabase
  .from('network_analytics')
  .select('*')
  .order('date', { ascending: false })
  .limit(30);

// Calculate average network percentage
const avgNetwork = data.reduce((sum, day) => sum + day.network_percentage, 0) / data.length;
console.log(`Average internal: ${avgNetwork.toFixed(1)}%`);
```

---

## Performance Optimization

### Indexes (Already Created)

All critical queries have indexes:
- User lookups (email, phone, username)
- Wallet lookups
- Transaction queries
- Date-based queries

### Connection Pooling

Supabase uses PgBouncer for connection pooling. Your connection string automatically routes through it.

### Query Optimization Tips

1. **Use select() carefully** - Only fetch fields you need
2. **Limit results** - Always use `.limit()` for lists
3. **Use views** - `user_wallet_summary` pre-joins data
4. **Batch operations** - Use RPC functions for complex logic

---

## Backup & Recovery

### Automatic Backups

Supabase automatically backs up your database:
- **Free tier:** Daily backups, 7-day retention
- **Pro tier:** Daily backups, 30-day retention + point-in-time recovery

### Manual Backup

```bash
# Via Supabase CLI
supabase db dump -f backup.sql

# Restore
supabase db reset --with-seed backup.sql
```

---

## Monitoring

### Supabase Dashboard

Go to **Database** → **Metrics** to see:
- Active connections
- Query performance
- Table sizes
- Index usage

### Logs

Go to **Logs** to see:
- Query logs
- Error logs
- Real-time monitoring

### Set Up Alerts

Go to **Settings** → **Notifications**:
- Database > 80% capacity
- High query latency
- Authentication errors

---

## Security Best Practices

✅ **Never commit** `.env` file
✅ **Use service_role key** only on backend
✅ **Enable RLS** on all user tables
✅ **Validate inputs** before database operations
✅ **Use parameterized queries** (Supabase does this automatically)
✅ **Rotate keys** periodically
✅ **Monitor for suspicious activity**

---

## Next Steps

1. ✅ Set up Supabase project
2. ✅ Run migrations
3. ✅ Test connection
4. 🔲 Create seed data (test users, merchants)
5. 🔲 Integrate with Bankroll iOS app
6. 🔲 Set up real-time subscriptions
7. 🔲 Deploy to production

---

## Troubleshooting

### "relation does not exist"
Run migrations in correct order (001, then 002).

### "permission denied"
Make sure you're using `service_role` key on backend.

### "insufficient privilege"
Check RLS policies - service_role key should bypass all RLS.

### Connection timeout
Check your `SUPABASE_URL` is correct and project is active.

### "INSERT or UPDATE violates foreign key constraint"
Ensure referenced records exist (e.g., user must exist before creating wallet).

---

## Support

- **Supabase Docs:** https://supabase.com/docs
- **Discord:** https://discord.supabase.com
- **GitHub Issues:** https://github.com/supabase/supabase/issues

For Hedge Payments specific issues, refer to:
- `AGENTS_STATUS.md` - Agent system guide
- `AGENT_SYSTEM_COMPLETE.md` - Complete architecture
- `NETWORK_AWARE_AGENT_ARCHITECTURE.md` - Network economics

---

## Summary

You now have:
- ✅ PostgreSQL database with ACID transactions
- ✅ Financial ledger with double-entry accounting
- ✅ Real-time wallet updates
- ✅ Row-level security
- ✅ Atomic internal transfer function
- ✅ Network analytics tracking
- ✅ Auto-generated APIs

**Ready to process payments with 100% margin on internal transfers!** 🚀
