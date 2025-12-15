# Notion Product Roadmap Setup
## Hedge Payments + Bankroll Product Management

The **ProductRoadmapAgent** automatically syncs your product roadmap with Notion and prioritizes features based on network growth metrics.

---

## Why Use Notion for Roadmap?

✅ **Visual** - Kanban board, timeline, table views
✅ **Collaborative** - Team can update status, add notes
✅ **Integrated** - Agent auto-prioritizes based on network data
✅ **Automated** - Weekly reports generated automatically
✅ **Data-Driven** - Features scored by network impact

---

## Step 1: Create Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Fill in:
   - **Name:** `Hedge Payments Roadmap Bot`
   - **Associated workspace:** Your workspace
   - **Type:** Internal
   - **Capabilities:**
     - ✅ Read content
     - ✅ Update content
     - ✅ Insert content

4. Click **"Submit"**
5. Copy the **Internal Integration Token**
   - Looks like: `secret_xxxxxxxxxxxxx`

6. Save to `.env`:
   ```bash
   NOTION_API_KEY=secret_xxxxxxxxxxxxx
   ```

---

## Step 2: Create Roadmap Database

### Option A: Use Template (Easiest)

1. Duplicate this template: [Hedge Payments Roadmap Template](#) (TODO: Create template)

### Option B: Create from Scratch

1. In Notion, create a new **Database** (table view)
2. Name it: `Product Roadmap`
3. Add these properties:

| Property | Type | Options |
|----------|------|---------|
| **Name** | Title | - |
| **Status** | Status | Planned, In Progress, Done, Blocked |
| **Category** | Select | Network Growth, User Acquisition, Merchant Acquisition, Internal Transfer Optimization, Cost Reduction, UX Improvement, Compliance, Infrastructure |
| **Priority** | Number | 1, 2, 3... |
| **Effort** | Select | Small, Medium, Large |
| **Progress** | Number | 0-100 |
| **Completed Date** | Date | - |
| **Blocked Reason** | Text | - |
| **Description** | Text | - |
| **Network Impact** | Text | (Auto-filled by agent) |
| **Start Date** | Date | - |
| **Owner** | Person | Team members |

---

## Step 3: Share Database with Integration

1. Open your Product Roadmap database in Notion
2. Click **•••** (top right) → **Add connections**
3. Search for **"Hedge Payments Roadmap Bot"**
4. Click **Confirm**

---

## Step 4: Get Database ID

1. Open the database in Notion
2. Look at the URL:
   ```
   https://notion.so/[workspace]/[DATABASE_ID]?v=...
   ```

3. Copy the **DATABASE_ID** (32 character string)

4. Add to `.env`:
   ```bash
   NOTION_ROADMAP_DATABASE_ID=abcd1234efgh5678ijkl9012mnop3456
   ```

---

## Step 5: Initialize Agent

The agent is automatically initialized by the orchestrator!

```javascript
const { getOrchestrator } = require('./src/agents');

const orchestrator = getOrchestrator({
  db: supabaseDb,
  notionRoadmapDatabaseId: process.env.NOTION_ROADMAP_DATABASE_ID
});

await orchestrator.initialize();

// Access the agent
const roadmapAgent = orchestrator.getAgent('product_roadmap');
```

---

## Using the Agent

### 1. Sync Roadmap

Get current state of all features:

```javascript
const roadmap = await roadmapAgent.execute({
  type: 'sync_roadmap'
});

console.log('Roadmap:', roadmap.summary);
// {
//   total: 45,
//   inProgress: 8,
//   completed: 20,
//   planned: 15,
//   blocked: 2
// }
```

### 2. Update Feature Status

```javascript
await roadmapAgent.execute({
  type: 'update_feature_status',
  data: {
    featureId: 'notion-page-id',
    status: 'In Progress'
  }
});
```

### 3. Auto-Prioritize Features

Uses network analytics to score and re-prioritize all features:

```javascript
const result = await roadmapAgent.execute({
  type: 'prioritize_features'
});

console.log('Top priorities:', result.features.slice(0, 5));
```

**Prioritization Logic:**
- **Network Growth features** get highest score if network % < 70%
- **User/Merchant Acquisition** prioritized if counts are low
- **Quick wins** (small effort) get bonus points
- **Blocked items** get penalty
- **In Progress** items get bonus (don't context switch)

### 4. Generate Weekly Report

Automatically generates comprehensive weekly report:

```javascript
const report = await roadmapAgent.execute({
  type: 'generate_weekly_report'
});

console.log('Week', report.week);
console.log('Completed this week:', report.thisWeek.completedFeatures);
console.log('Network %:', report.networkMetrics.networkPercentage);
console.log('Insights:', report.insights);
```

**Report includes:**
- ✅ Features completed this week
- 🔄 Features in progress
- 🚫 Blocked features
- 📊 Network metrics (volume, %, profit margin)
- 💡 AI-generated insights
- 🎯 Next week's top priorities

### 5. Create New Feature

```javascript
await roadmapAgent.execute({
  type: 'create_feature',
  data: {
    name: 'Add Apple Pay support',
    category: 'User Acquisition',
    status: 'Planned',
    effort: 'Medium',
    priority: 5
  }
});
```

### 6. Track Feature's Network Impact

After launching a feature, measure its impact:

```javascript
const impact = await roadmapAgent.execute({
  type: 'track_network_impact',
  data: {
    featureId: 'notion-page-id'
  }
});

console.log('Impact:', impact);
// {
//   networkPercentageChange: +3.5,  // Network % increased!
//   volumeChange: 125000,            // $125K more volume
//   profitMarginChange: +2.1,        // Margin improved
//   assessment: {
//     level: 'medium',
//     message: 'Positive impact on network growth',
//     emoji: '✅'
//   }
// }
```

### 7. Get Current Status

Quick snapshot:

```javascript
const status = await roadmapAgent.execute({
  type: 'get_roadmap_status'
});

console.log('Top 5 priorities:', status.topPriorities);
console.log('Recently completed:', status.recentlyCompleted);
console.log('Blocked items:', status.blockedItems);
```

---

## Automated Workflows

### Daily: Auto-Sync

```javascript
// In your cron job or scheduled task
setInterval(async () => {
  await roadmapAgent.execute({ type: 'sync_roadmap' });
}, 24 * 60 * 60 * 1000); // Daily
```

### Weekly: Generate Report

```javascript
// Every Monday morning
const cron = require('node-cron');

cron.schedule('0 9 * * 1', async () => {
  const report = await roadmapAgent.execute({
    type: 'generate_weekly_report'
  });

  // Send to team (Slack, email, etc.)
  await sendWeeklyReportToTeam(report);
});
```

### After Feature Launch: Track Impact

```javascript
// When a feature status changes to "Done"
eventBus.subscribe('roadmap:feature_updated', async (payload) => {
  if (payload.status === 'Done') {
    // Wait 1 week to measure impact
    setTimeout(async () => {
      const impact = await roadmapAgent.execute({
        type: 'track_network_impact',
        data: { featureId: payload.featureId }
      });

      console.log('Feature impact:', impact);
    }, 7 * 24 * 60 * 60 * 1000);
  }
});
```

---

## Feature Scoring Algorithm

The agent scores features based on:

### Base Score (by category)
- **Network Growth:** 10 points
- **Internal Transfer Optimization:** 9 points
- **User Acquisition:** 8 points
- **Merchant Acquisition:** 8 points
- **Cost Reduction:** 7 points
- **UX Improvement:** 6 points
- **Compliance:** 5 points
- **Infrastructure:** 4 points

### Network Effect Boost
- If network % < 70%: **+5 points** for network growth features
- Helps prioritize getting to 70%+ internal transactions

### Growth Boost
- If user growth rate < 10%: **+3 points** for user acquisition
- If merchant count < 100: **+3 points** for merchant acquisition

### Status Modifiers
- **In Progress:** +2 points (avoid context switching)
- **Blocked:** -5 points (can't work on it)

### Effort Modifier
- **Small effort:** +1 point (quick win!)
- **Large effort:** -2 points (prefer smaller tasks)

### Example Scoring

```
Feature: "Add merchant referral program"
- Category: Merchant Acquisition = 8 points
- Current merchants: 45 (< 100) = +3 points
- Effort: Small = +1 point
- Status: Planned = 0 points
Total Score: 12 points

Feature: "Rebuild payment infrastructure"
- Category: Infrastructure = 4 points
- Large effort = -2 points
- Status: In Progress = +2 points
Total Score: 4 points

→ Merchant referral gets prioritized!
```

---

## Sample Weekly Report

```json
{
  "week": 45,
  "date": "2025-11-10",
  "roadmap": {
    "totalFeatures": 45,
    "completed": 20,
    "inProgress": 8,
    "planned": 15,
    "blocked": 2
  },
  "thisWeek": {
    "completedFeatures": 3,
    "features": [
      {
        "name": "Apple Pay integration",
        "category": "User Acquisition",
        "completedDate": "2025-11-08"
      },
      {
        "name": "Merchant dashboard v2",
        "category": "Merchant Acquisition",
        "completedDate": "2025-11-09"
      },
      {
        "name": "Instant settlement for USDC",
        "category": "Internal Transfer Optimization",
        "completedDate": "2025-11-10"
      }
    ]
  },
  "networkMetrics": {
    "networkPercentage": "68.5%",
    "totalVolume": "$2,150,000",
    "profitMargin": "48.2%",
    "activeUsers": 5200,
    "activeMerchants": 52,
    "weeklyGrowth": {
      "users": 320,
      "merchants": 4,
      "volume": 175000
    }
  },
  "insights": [
    {
      "type": "info",
      "message": "Network percentage is 68.5%. Close to 70% target!",
      "recommendation": "One more merchant acquisition push to hit 70%"
    },
    {
      "type": "success",
      "message": "Great profit margin of 48.2%!",
      "recommendation": "Network effect is working well"
    },
    {
      "type": "info",
      "message": "44% of roadmap features completed (20/45)",
      "recommendation": "Good progress!"
    }
  ],
  "nextWeek": {
    "topPriorities": [
      {
        "name": "Merchant referral program",
        "category": "Merchant Acquisition",
        "priority": 1
      },
      {
        "name": "User balance optimization suggestions",
        "category": "Network Growth",
        "priority": 2
      },
      {
        "name": "Merchant discovery in Bankroll app",
        "category": "Network Growth",
        "priority": 3
      }
    ]
  }
}
```

---

## Notion Views

Create these views in your database for best results:

### 1. Kanban Board (by Status)
- Group by: **Status**
- Sort by: **Priority**
- Perfect for daily standup!

### 2. Priority List
- Filter: **Status** is not **Done**
- Sort by: **Priority** (ascending)
- Shows what to work on next

### 3. Timeline (by Start Date)
- View: Timeline
- Date property: **Start Date** to **Completed Date**
- See project schedule

### 4. By Category
- Group by: **Category**
- Sort by: **Priority**
- See balance across categories

### 5. Network Impact
- Filter: **Status** is **Done**
- Sort by: **Completed Date** (descending)
- Review feature impacts

---

## Integration with Network Analytics

The agent pulls data from Supabase to inform prioritization:

```javascript
// From network_analytics table
{
  networkPercentage: 68.5,    // % of internal transactions
  totalVolume: 2150000,        // Total $ volume
  profitMargin: 48.2,          // Blended profit margin
  activeUsers: 5200,           // Active Bankroll users
  activeMerchants: 52,         // Active Hedge merchants
  userGrowthRate: 15,          // % growth
  weeklyGrowth: {
    users: 320,                // +320 users this week
    merchants: 4,              // +4 merchants this week
    volume: 175000             // +$175K volume
  }
}
```

Features are prioritized to **maximize network percentage** and **profit margin**.

---

## Events Emitted

The agent emits these events:

- `roadmap:feature_updated` - Feature status changed
- `roadmap:feature_created` - New feature added
- `roadmap:weekly_report` - Weekly report generated

Subscribe to events:

```javascript
eventBus.subscribe('roadmap:weekly_report', (report) => {
  console.log('Weekly report ready:', report.week);
  // Send to Slack, email team, etc.
});
```

---

## Troubleshooting

### "database_id not found"
- Make sure you shared the database with your integration
- Check the database ID is correct (32 characters)

### "Unauthorized"
- Verify your Notion API key is correct
- Check integration has Read/Write permissions

### "Property not found"
- Ensure all required properties exist in database
- Check property names match exactly (case-sensitive)

### Agent not prioritizing correctly
- Check network analytics are being collected daily
- Run `aggregate_daily_analytics` function in Supabase
- Verify Supabase connection is working

---

## Best Practices

✅ **Update status regularly** - Keep Notion in sync with actual work
✅ **Use categories correctly** - Helps agent prioritize properly
✅ **Set effort sizes** - Agent prefers quick wins
✅ **Mark blockers** - Agent will deprioritize blocked items
✅ **Review weekly reports** - Adjust strategy based on insights
✅ **Track impact** - Measure what works, double down on it

---

## Next Steps

1. ✅ Create Notion integration
2. ✅ Set up database
3. ✅ Add to `.env`
4. ✅ Add initial features to roadmap
5. 🔲 Run weekly report generation
6. 🔲 Set up automated workflows
7. 🔲 Share reports with team

---

## Example: Full Workflow

```javascript
// Monday morning: Generate weekly report
const report = await roadmapAgent.execute({
  type: 'generate_weekly_report'
});

// Tuesday: Re-prioritize based on network data
await roadmapAgent.execute({
  type: 'prioritize_features'
});

// Throughout week: Update status as you work
await roadmapAgent.execute({
  type: 'update_feature_status',
  data: {
    featureId: 'abc123',
    status: 'In Progress'
  }
});

// Friday: Feature shipped!
await roadmapAgent.execute({
  type: 'update_feature_status',
  data: {
    featureId: 'abc123',
    status: 'Done'
  }
});

// Next week: Measure impact
setTimeout(async () => {
  const impact = await roadmapAgent.execute({
    type: 'track_network_impact',
    data: { featureId: 'abc123' }
  });

  if (impact.assessment.level === 'high') {
    console.log('🚀 This feature crushed it!');
  }
}, 7 * 24 * 60 * 60 * 1000);
```

---

**The agent keeps your roadmap data-driven and network-focused!** 📊🚀
