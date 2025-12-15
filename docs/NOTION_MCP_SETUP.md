# Notion MCP Configuration for Claude Code

## Quick Setup

The Notion MCP tools are already available in Claude Code, but need your API credentials.

### Step 1: Get Your Notion Credentials

1. **API Key:** If you have your integration, get the Internal Integration Token
   - Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Select your integration
   - Copy the "Internal Integration Token" (starts with `secret_`)

2. **Database ID:** From your Product Roadmap database
   - Open the database in Notion
   - Look at the URL: `https://notion.so/[workspace]/[DATABASE_ID]?v=...`
   - Copy the DATABASE_ID (32 character string)

### Step 2: Configure Notion in Claude Code

The Notion MCP server is likely already installed in Claude Code. We just need to configure it with your credentials.

**Option A: Check Current MCP Configuration**

Look at your Claude Code MCP configuration. It's typically in:
```
~/.claude/mcp.json
```

Or for this project specifically:
```
/Users/jacksonfitzgerald/.claude.json
```

**Option B: Add Notion Credentials to Environment**

Add to your project's `.env`:
```bash
NOTION_API_KEY=secret_your_key_here
NOTION_ROADMAP_DATABASE_ID=your_database_id_here
```

### Step 3: Test Connection

Once configured, I can access your Notion through the MCP tools to:
- ✅ Read your existing roadmap
- ✅ Query database
- ✅ Create pages
- ✅ Update properties
- ✅ Search content

---

## For N8N Integration

When you set up N8N automation, you'll want to:

### 1. N8N → Notion (Write)
- Create new roadmap items from external sources
- Update feature statuses automatically
- Add notes from team meetings
- Link to GitHub issues, Jira tickets, etc.

### 2. Notion → N8N (Read)
- Trigger workflows when status changes
- Send notifications on completed features
- Update external tools (Slack, Linear, etc.)
- Generate reports

### 3. Hedge Payments API → N8N → Notion
This is where it gets powerful!

**Network Metrics → Roadmap Priorities**
```
Daily Analytics Aggregation (Supabase)
  ↓
N8N Workflow Triggered
  ↓
Fetch Network Metrics (API call)
  ↓
Calculate Feature Scores
  ↓
Update Notion Priorities
  ↓
Send Report to Slack
```

**Feature Launch → Impact Tracking**
```
Feature Status → "Done" (Notion)
  ↓
N8N Detects Change (webhook)
  ↓
Wait 7 days
  ↓
Fetch Before/After Metrics (API)
  ↓
Calculate Impact
  ↓
Update Notion with Results
  ↓
Notify Team if High Impact
```

---

## Architecture: ProductRoadmapAgent + N8N

```
┌─────────────────────────────────────────────────────────┐
│                    Notion Database                      │
│                  (Product Roadmap)                      │
└─────────────────────────────────────────────────────────┘
         ↑                           ↑
         │                           │
         │ Read/Write                │ Read/Write
         │                           │
    ┌────┴─────┐              ┌─────┴──────┐
    │          │              │            │
    │   MCP    │              │    N8N     │
    │  Tools   │              │ Workflows  │
    │          │              │            │
    └────┬─────┘              └─────┬──────┘
         │                           │
         │                           │
         ↓                           ↓
┌─────────────────────────────────────────────────────────┐
│            ProductRoadmapAgent                          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Can be triggered by:                            │  │
│  │  • Claude Code (manual)                          │  │
│  │  • API endpoint (programmatic)                   │  │
│  │  • Cron job (scheduled)                          │  │
│  │  • N8N webhook (automated)                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Connects to:                                          │
│  • Notion (via MCP)                                    │
│  • Supabase (network metrics)                          │
│  • EventBus (emit events)                              │
└─────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────┐
│              Supabase Database                          │
│         (Network Analytics, Transactions)               │
└─────────────────────────────────────────────────────────┘
```

---

## N8N Workflow Examples

### Workflow 1: Daily Roadmap Sync + Prioritization

**Trigger:** Cron (every day at 9 AM)

1. **HTTP Request** → Fetch network analytics
   ```
   GET /api/analytics/summary
   ```

2. **Notion Node** → Query roadmap database
   ```
   Query all features where Status != Done
   ```

3. **Function Node** → Score each feature
   ```javascript
   // Use same scoring logic as ProductRoadmapAgent
   const score = calculateScore(feature, networkMetrics);
   return { ...feature, score };
   ```

4. **Notion Node** → Update priorities
   ```
   For each feature:
     Update Priority field with new score
   ```

5. **Slack Node** → Send update
   ```
   "Roadmap re-prioritized! Network % is 68.5%"
   ```

---

### Workflow 2: Feature Impact Tracker

**Trigger:** Notion Webhook (when Status → Done)

1. **Wait** → 7 days

2. **HTTP Request** → Get metrics before launch
   ```
   GET /api/analytics/date?date=launch_date
   ```

3. **HTTP Request** → Get current metrics
   ```
   GET /api/analytics/latest
   ```

4. **Function Node** → Calculate impact
   ```javascript
   const impact = {
     networkChange: current.network_pct - before.network_pct,
     volumeChange: current.volume - before.volume,
     marginChange: current.margin - before.margin
   };
   ```

5. **Notion Node** → Update feature
   ```
   Update "Network Impact" field with results
   ```

6. **IF Node** → High impact?
   ```
   If impact.networkChange > 5%
   ```

7a. **Slack Node** → Celebrate!
   ```
   "🚀 Feature X increased network % by 5.2%!"
   ```

7b. **Notion Node** → Add to "Success Stories" database

---

### Workflow 3: Auto-Create Features from GitHub

**Trigger:** GitHub Webhook (new issue with label "feature")

1. **GitHub Node** → Get issue details

2. **Function Node** → Parse and categorize
   ```javascript
   // Analyze issue title/body to determine category
   const category = detectCategory(issue.title);
   const effort = estimateEffort(issue.body);
   ```

3. **Notion Node** → Create feature
   ```
   Create page in Product Roadmap database
   ```

4. **GitHub Node** → Add comment
   ```
   "✅ Added to product roadmap: [Notion Link]"
   ```

---

### Workflow 4: Weekly Report Generator

**Trigger:** Cron (every Monday at 9 AM)

1. **Notion Node** → Query completed features
   ```
   Query where Status = Done AND
   CompletedDate > 7 days ago
   ```

2. **HTTP Request** → Get weekly metrics
   ```
   GET /api/analytics/weekly
   ```

3. **Function Node** → Generate insights
   ```javascript
   // Use ProductRoadmapAgent logic
   const insights = generateInsights(features, metrics);
   ```

4. **Notion Node** → Create report page
   ```
   Create page in "Weekly Reports" database
   ```

5. **Slack Node** → Post to #product channel
   ```
   "📊 Week 45 Report: 3 features shipped,
   network % at 68.5% (+2.1%)"
   ```

6. **Email Node** → Send to stakeholders

---

## API Endpoints for N8N

You'll want to expose these endpoints from your Hedge Payments API:

```javascript
// In src/routes/analytics.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/supabase');

// Get current network analytics
router.get('/analytics/summary', async (req, res) => {
  const analytics = await db.getNetworkAnalytics(7);
  const latest = analytics[0];

  res.json({
    networkPercentage: latest.network_percentage,
    totalVolume: latest.total_volume,
    profitMargin: latest.profit_margin,
    activeUsers: latest.active_users,
    activeMerchants: latest.active_merchants
  });
});

// Get analytics for specific date
router.get('/analytics/date', async (req, res) => {
  const { date } = req.query;
  const analytics = await db.query(`
    SELECT * FROM network_analytics
    WHERE date = $1
  `, [date]);

  res.json(analytics[0]);
});

// Trigger roadmap sync
router.post('/roadmap/sync', async (req, res) => {
  const orchestrator = getOrchestrator();
  const result = await orchestrator.getAgent('product_roadmap')
    .execute({ type: 'sync_roadmap' });

  res.json(result);
});

// Trigger feature prioritization
router.post('/roadmap/prioritize', async (req, res) => {
  const orchestrator = getOrchestrator();
  const result = await orchestrator.getAgent('product_roadmap')
    .execute({ type: 'prioritize_features' });

  res.json(result);
});

// Generate weekly report
router.post('/roadmap/report/weekly', async (req, res) => {
  const orchestrator = getOrchestrator();
  const report = await orchestrator.getAgent('product_roadmap')
    .execute({ type: 'generate_weekly_report' });

  res.json(report);
});

module.exports = router;
```

---

## N8N Best Practices

### 1. Use Error Handling
Always add error nodes to handle API failures:
```
[Main Workflow] → [Error Trigger] → [Slack Alert]
```

### 2. Log Everything
Store workflow run logs in Supabase:
```sql
CREATE TABLE n8n_workflow_runs (
  id UUID PRIMARY KEY,
  workflow_name TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT,
  input JSONB,
  output JSONB,
  error TEXT
);
```

### 3. Use Webhooks for Real-Time
Set up Notion webhooks (or poll) to detect changes:
```
Notion Change → Notion API → N8N Webhook → Your API
```

### 4. Rate Limiting
Be careful with Notion API rate limits:
- 3 requests per second
- Use batch operations when possible
- Add delays between requests

### 5. Idempotency
Make sure workflows can run multiple times safely:
```javascript
// Check if already processed
const exists = await checkIfExists(item.id);
if (exists) return; // Skip

// Process item
await processItem(item);
```

---

## Environment Variables for N8N

Add these to your N8N environment:

```bash
# Hedge Payments API
HEDGE_API_URL=https://api.hedgepayments.com
HEDGE_API_KEY=your_api_key

# Notion
NOTION_API_KEY=secret_xxxxx
NOTION_ROADMAP_DB_ID=xxxxx

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=xxxxx

# Slack (for notifications)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx
```

---

## Next Steps

1. **Share your Notion API key** so I can access your workspace
2. **Share your roadmap database ID**
3. I'll connect and explore your current setup
4. We'll map out which N8N workflows to build first

What should we tackle first?
