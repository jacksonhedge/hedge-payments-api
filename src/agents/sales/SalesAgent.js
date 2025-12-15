const Agent = require('../base/Agent');
const logger = require('../../utils/logger');

/**
 * Sales Agent
 *
 * Manages sales pipeline, leads, opportunities, and deals
 * Integrates with Notion CRM for pipeline management
 * Coordinates with UserAdoptionAgent for B2C adoption
 */
class SalesAgent extends Agent {
  constructor(config) {
    super({
      name: 'SalesAgent',
      type: 'sales',
      team: 'SalesManagement',
      ...config
    });

    this.notionAgent = config.notionAgent;
    this.zapierAgent = config.zapierAgent;
    this.userAdoptionAgent = config.userAdoptionAgent;
    this.db = config.db;

    // Notion database IDs
    this.databases = {
      salesPipeline: config.salesPipelineDatabaseId,
      leads: config.leadsDatabaseId,
      opportunities: config.opportunitiesDatabaseId,
      deals: config.dealsDatabaseId
    };

    // Sales stages
    this.stages = [
      'Lead',
      'Qualified',
      'Demo Scheduled',
      'Demo Completed',
      'Proposal Sent',
      'Negotiation',
      'Closed Won',
      'Closed Lost'
    ];

    // Pipeline metrics cache
    this.pipelineMetrics = {
      totalValue: 0,
      weightedValue: 0,
      conversionRate: 0,
      averageDealSize: 0,
      lastUpdated: null
    };

    logger.info('SalesAgent initialized');
  }

  /**
   * Perform task
   */
  async performTask(task) {
    const { data } = task;

    switch (task.type) {
      // Lead Management
      case 'create_lead':
        return await this.createLead(data.lead);

      case 'qualify_lead':
        return await this.qualifyLead(data.leadId);

      case 'update_lead':
        return await this.updateLead(data.leadId, data.updates);

      case 'get_leads':
        return await this.getLeads(data.filters);

      // Opportunity Management
      case 'create_opportunity':
        return await this.createOpportunity(data.opportunity);

      case 'update_opportunity':
        return await this.updateOpportunity(data.opportunityId, data.updates);

      case 'move_stage':
        return await this.moveToStage(data.opportunityId, data.stage);

      case 'get_opportunities':
        return await this.getOpportunities(data.filters);

      // Deal Management
      case 'create_deal':
        return await this.createDeal(data.deal);

      case 'close_deal':
        return await this.closeDeal(data.dealId, data.status, data.notes);

      case 'get_deals':
        return await this.getDeals(data.filters);

      // Pipeline Analytics
      case 'get_pipeline_metrics':
        return await this.getPipelineMetrics(data.refresh);

      case 'forecast_revenue':
        return await this.forecastRevenue(data.period);

      case 'generate_sales_report':
        return await this.generateSalesReport(data.period);

      // Automation
      case 'automate_follow_ups':
        return await this.automateFollowUps();

      case 'score_leads':
        return await this.scoreLeads();

      case 'suggest_next_actions':
        return await this.suggestNextActions(data.opportunityId);

      // Integration
      case 'sync_pipeline':
        return await this.syncPipelineFromNotion();

      case 'notify_team':
        return await this.notifyTeam(data.event, data.details);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  // ============================================
  // Lead Management
  // ============================================

  /**
   * Create a new lead in Notion CRM
   */
  async createLead(lead) {
    this.log('info', 'Creating lead', { name: lead.companyName || lead.name });

    const properties = {
      Name: {
        title: [
          {
            text: { content: lead.companyName || lead.name }
          }
        ]
      },
      Type: {
        select: { name: lead.type || 'B2B' } // B2B, B2C, Partnership
      },
      Status: {
        select: { name: 'Lead' }
      },
      Source: {
        select: { name: lead.source || 'Unknown' }
      },
      Contact: {
        rich_text: [
          {
            type: 'text',
            text: { content: lead.contactName || '' }
          }
        ]
      },
      Email: {
        email: lead.email
      },
      Phone: {
        phone_number: lead.phone || null
      },
      EstimatedValue: {
        number: lead.estimatedValue || 0
      },
      Industry: {
        select: { name: lead.industry || 'Other' }
      },
      Notes: {
        rich_text: [
          {
            type: 'text',
            text: { content: lead.notes || '' }
          }
        ]
      }
    };

    const result = await this.notionAgent.execute({
      type: 'create_page',
      data: {
        parentId: this.databases.salesPipeline,
        properties
      }
    });

    // Score the lead
    const leadScore = this.calculateLeadScore(lead);

    // Update with lead score
    await this.notionAgent.execute({
      type: 'update_page',
      data: {
        pageId: result.id,
        properties: {
          LeadScore: { number: leadScore }
        }
      }
    });

    this.emitEvent('sales:lead_created', {
      leadId: result.id,
      name: lead.companyName || lead.name,
      score: leadScore
    });

    // Notify team if high-value lead
    if (lead.estimatedValue > 50000) {
      await this.notifyTeam('high_value_lead', {
        leadId: result.id,
        name: lead.companyName || lead.name,
        value: lead.estimatedValue
      });
    }

    return {
      leadId: result.id,
      leadScore,
      message: 'Lead created successfully'
    };
  }

  /**
   * Qualify a lead (move to Qualified stage)
   */
  async qualifyLead(leadId) {
    this.log('info', 'Qualifying lead', { leadId });

    // Get lead details
    const lead = await this.notionAgent.execute({
      type: 'get_page',
      data: { pageId: leadId }
    });

    // Update status to Qualified
    await this.notionAgent.execute({
      type: 'update_page',
      data: {
        pageId: leadId,
        properties: {
          Status: { select: { name: 'Qualified' } },
          QualifiedDate: { date: { start: new Date().toISOString() } }
        }
      }
    });

    this.emitEvent('sales:lead_qualified', { leadId });

    // Suggest next actions
    const nextActions = await this.suggestNextActions(leadId);

    return {
      qualified: true,
      leadId,
      nextActions
    };
  }

  /**
   * Update lead information
   */
  async updateLead(leadId, updates) {
    this.log('info', 'Updating lead', { leadId });

    const properties = this.buildNotionProperties(updates);

    await this.notionAgent.execute({
      type: 'update_page',
      data: {
        pageId: leadId,
        properties
      }
    });

    this.emitEvent('sales:lead_updated', { leadId, updates });

    return { success: true, leadId };
  }

  /**
   * Get leads with optional filters
   */
  async getLeads(filters = {}) {
    this.log('info', 'Getting leads', { filters });

    const notionFilter = this.buildNotionFilter(filters);

    const results = await this.notionAgent.execute({
      type: 'query_database',
      data: {
        databaseId: this.databases.salesPipeline,
        filter: notionFilter,
        sorts: [
          {
            property: 'LeadScore',
            direction: 'descending'
          }
        ]
      }
    });

    return {
      leads: results.results,
      count: results.count
    };
  }

  // ============================================
  // Opportunity Management
  // ============================================

  /**
   * Create opportunity from qualified lead
   */
  async createOpportunity(opportunity) {
    this.log('info', 'Creating opportunity', { name: opportunity.name });

    const properties = {
      Name: {
        title: [{ text: { content: opportunity.name } }]
      },
      Stage: {
        select: { name: opportunity.stage || 'Demo Scheduled' }
      },
      Value: {
        number: opportunity.value
      },
      Probability: {
        number: this.getStageProbability(opportunity.stage || 'Demo Scheduled')
      },
      ExpectedCloseDate: {
        date: { start: opportunity.expectedCloseDate }
      },
      ContactName: {
        rich_text: [{ type: 'text', text: { content: opportunity.contactName } }]
      },
      CompanyName: {
        rich_text: [{ type: 'text', text: { content: opportunity.companyName } }]
      },
      Type: {
        select: { name: opportunity.type || 'New Business' }
      }
    };

    const result = await this.notionAgent.execute({
      type: 'create_page',
      data: {
        parentId: this.databases.salesPipeline,
        properties
      }
    });

    this.emitEvent('sales:opportunity_created', {
      opportunityId: result.id,
      value: opportunity.value
    });

    return {
      opportunityId: result.id,
      message: 'Opportunity created successfully'
    };
  }

  /**
   * Move opportunity to different stage
   */
  async moveToStage(opportunityId, newStage) {
    this.log('info', 'Moving opportunity', { opportunityId, newStage });

    const probability = this.getStageProbability(newStage);

    await this.notionAgent.execute({
      type: 'update_page',
      data: {
        pageId: opportunityId,
        properties: {
          Stage: { select: { name: newStage } },
          Probability: { number: probability },
          LastUpdated: { date: { start: new Date().toISOString() } }
        }
      }
    });

    this.emitEvent('sales:opportunity_stage_changed', {
      opportunityId,
      newStage,
      probability
    });

    // Notify team if close to closing
    if (newStage === 'Negotiation') {
      await this.notifyTeam('deal_in_negotiation', { opportunityId });
    }

    return {
      success: true,
      opportunityId,
      stage: newStage,
      probability
    };
  }

  /**
   * Update opportunity
   */
  async updateOpportunity(opportunityId, updates) {
    this.log('info', 'Updating opportunity', { opportunityId });

    const properties = this.buildNotionProperties(updates);

    await this.notionAgent.execute({
      type: 'update_page',
      data: {
        pageId: opportunityId,
        properties
      }
    });

    this.emitEvent('sales:opportunity_updated', { opportunityId, updates });

    return { success: true, opportunityId };
  }

  /**
   * Get opportunities
   */
  async getOpportunities(filters = {}) {
    this.log('info', 'Getting opportunities', { filters });

    const notionFilter = this.buildNotionFilter({
      ...filters,
      status: ['Demo Scheduled', 'Demo Completed', 'Proposal Sent', 'Negotiation']
    });

    const results = await this.notionAgent.execute({
      type: 'query_database',
      data: {
        databaseId: this.databases.salesPipeline,
        filter: notionFilter,
        sorts: [
          {
            property: 'Value',
            direction: 'descending'
          }
        ]
      }
    });

    return {
      opportunities: results.results,
      count: results.count
    };
  }

  // ============================================
  // Deal Management
  // ============================================

  /**
   * Close deal (won or lost)
   */
  async closeDeal(dealId, status, notes) {
    this.log('info', 'Closing deal', { dealId, status });

    await this.notionAgent.execute({
      type: 'update_page',
      data: {
        pageId: dealId,
        properties: {
          Stage: { select: { name: status === 'won' ? 'Closed Won' : 'Closed Lost' } },
          ClosedDate: { date: { start: new Date().toISOString() } },
          ClosedNotes: {
            rich_text: [{ type: 'text', text: { content: notes || '' } }]
          }
        }
      }
    });

    this.emitEvent('sales:deal_closed', { dealId, status });

    // Notify team
    await this.notifyTeam(status === 'won' ? 'deal_won' : 'deal_lost', {
      dealId,
      notes
    });

    // If won and it's a fraternity deal, notify UserAdoptionAgent
    if (status === 'won') {
      const deal = await this.notionAgent.execute({
        type: 'get_page',
        data: { pageId: dealId }
      });

      // Check if it's a fraternity partnership
      if (deal.properties.Type?.select?.name === 'Fraternity Partnership') {
        this.emitEvent('sales:fraternity_deal_won', {
          dealId,
          fraternityName: deal.properties.Name.title[0]?.text?.content
        });
      }
    }

    return {
      success: true,
      dealId,
      status
    };
  }

  /**
   * Get closed deals
   */
  async getDeals(filters = {}) {
    this.log('info', 'Getting deals', { filters });

    const notionFilter = this.buildNotionFilter({
      ...filters,
      status: ['Closed Won', 'Closed Lost']
    });

    const results = await this.notionAgent.execute({
      type: 'query_database',
      data: {
        databaseId: this.databases.salesPipeline,
        filter: notionFilter
      }
    });

    return {
      deals: results.results,
      count: results.count
    };
  }

  // ============================================
  // Pipeline Analytics
  // ============================================

  /**
   * Get pipeline metrics
   */
  async getPipelineMetrics(refresh = false) {
    // Return cached if recent
    if (!refresh && this.pipelineMetrics.lastUpdated) {
      const age = Date.now() - this.pipelineMetrics.lastUpdated;
      if (age < 5 * 60 * 1000) { // 5 minutes
        return this.pipelineMetrics;
      }
    }

    this.log('info', 'Calculating pipeline metrics');

    // Get all opportunities
    const opportunities = await this.getOpportunities({});

    let totalValue = 0;
    let weightedValue = 0;
    const stageCounts = {};

    opportunities.opportunities.forEach(opp => {
      const value = opp.properties.Value?.number || 0;
      const probability = opp.properties.Probability?.number || 0;
      const stage = opp.properties.Stage?.select?.name;

      totalValue += value;
      weightedValue += (value * probability / 100);

      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    // Get closed deals for conversion rate
    const closedDeals = await this.getDeals({});
    const wonDeals = closedDeals.deals.filter(
      d => d.properties.Stage?.select?.name === 'Closed Won'
    );

    const conversionRate = closedDeals.count > 0
      ? (wonDeals.length / closedDeals.count) * 100
      : 0;

    const averageDealSize = wonDeals.length > 0
      ? wonDeals.reduce((sum, d) => sum + (d.properties.Value?.number || 0), 0) / wonDeals.length
      : 0;

    this.pipelineMetrics = {
      totalValue,
      weightedValue,
      conversionRate,
      averageDealSize,
      opportunityCount: opportunities.count,
      stageCounts,
      lastUpdated: Date.now()
    };

    return this.pipelineMetrics;
  }

  /**
   * Forecast revenue for a period
   */
  async forecastRevenue(period = 'quarter') {
    this.log('info', 'Forecasting revenue', { period });

    const endDate = this.getEndDate(period);

    // Get opportunities expected to close in period
    const opportunities = await this.getOpportunities({
      expectedCloseDateBefore: endDate
    });

    let forecast = {
      period,
      conservative: 0, // 50% probability or higher
      realistic: 0,    // Weighted probability
      optimistic: 0    // All opportunities
    };

    opportunities.opportunities.forEach(opp => {
      const value = opp.properties.Value?.number || 0;
      const probability = opp.properties.Probability?.number || 0;

      forecast.optimistic += value;
      forecast.realistic += (value * probability / 100);

      if (probability >= 50) {
        forecast.conservative += value;
      }
    });

    return forecast;
  }

  /**
   * Generate sales report
   */
  async generateSalesReport(period = 'month') {
    this.log('info', 'Generating sales report', { period });

    const { startDate, endDate } = this.getPeriodDates(period);

    // Get metrics
    const metrics = await this.getPipelineMetrics(true);
    const forecast = await this.forecastRevenue(period);

    // Get deals closed in period
    const closedDeals = await this.getDeals({
      closedDateAfter: startDate,
      closedDateBefore: endDate
    });

    const wonDeals = closedDeals.deals.filter(
      d => d.properties.Stage?.select?.name === 'Closed Won'
    );

    const totalRevenue = wonDeals.reduce(
      (sum, d) => sum + (d.properties.Value?.number || 0),
      0
    );

    const report = {
      period,
      startDate,
      endDate,
      metrics: {
        ...metrics,
        revenue: totalRevenue,
        dealsWon: wonDeals.length,
        dealsClosed: closedDeals.count
      },
      forecast,
      topDeals: wonDeals.slice(0, 5).map(d => ({
        name: d.properties.Name?.title[0]?.text?.content,
        value: d.properties.Value?.number,
        closedDate: d.properties.ClosedDate?.date?.start
      }))
    };

    // Create report page in Notion
    await this.createReportPage(report);

    // Send to team via Zapier
    await this.zapierAgent.execute({
      type: 'trigger_webhook',
      data: {
        webhookUrl: process.env.ZAPIER_SALES_REPORT_WEBHOOK,
        payload: {
          event: 'sales_report_generated',
          report
        }
      }
    });

    return report;
  }

  // ============================================
  // Automation & Intelligence
  // ============================================

  /**
   * Automate follow-up reminders
   */
  async automateFollowUps() {
    this.log('info', 'Automating follow-ups');

    const opportunities = await this.getOpportunities({});

    const needsFollowUp = [];

    opportunities.opportunities.forEach(opp => {
      const lastUpdated = new Date(opp.properties.LastUpdated?.date?.start || opp.created_time);
      const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

      // Follow up if no update in 3 days
      if (daysSinceUpdate > 3) {
        needsFollowUp.push({
          opportunityId: opp.id,
          name: opp.properties.Name?.title[0]?.text?.content,
          stage: opp.properties.Stage?.select?.name,
          daysSinceUpdate: Math.floor(daysSinceUpdate)
        });
      }
    });

    // Send notifications
    if (needsFollowUp.length > 0) {
      await this.notifyTeam('follow_ups_needed', {
        count: needsFollowUp.length,
        opportunities: needsFollowUp
      });
    }

    return {
      needsFollowUp: needsFollowUp.length,
      opportunities: needsFollowUp
    };
  }

  /**
   * Score leads based on various factors
   */
  async scoreLeads() {
    this.log('info', 'Scoring all leads');

    const leads = await this.getLeads({ status: 'Lead' });

    const scored = [];

    for (const lead of leads.leads) {
      const leadData = this.parseNotionPage(lead);
      const score = this.calculateLeadScore(leadData);

      // Update score in Notion
      await this.notionAgent.execute({
        type: 'update_page',
        data: {
          pageId: lead.id,
          properties: {
            LeadScore: { number: score }
          }
        }
      });

      scored.push({
        leadId: lead.id,
        name: leadData.name,
        score
      });
    }

    return {
      scored: scored.length,
      leads: scored.sort((a, b) => b.score - a.score)
    };
  }

  /**
   * Calculate lead score (0-100)
   */
  calculateLeadScore(lead) {
    let score = 0;

    // Company size / value
    if (lead.estimatedValue > 100000) score += 30;
    else if (lead.estimatedValue > 50000) score += 20;
    else if (lead.estimatedValue > 10000) score += 10;

    // Industry fit
    const highValueIndustries = ['Gaming', 'Fintech', 'Payments', 'Education'];
    if (highValueIndustries.includes(lead.industry)) score += 20;

    // Source quality
    const highQualitySources = ['Referral', 'Direct', 'Partnership'];
    if (highQualitySources.includes(lead.source)) score += 15;

    // Contact info completeness
    if (lead.email) score += 10;
    if (lead.phone) score += 10;
    if (lead.contactName) score += 10;

    // Engagement
    if (lead.responded) score += 15;

    return Math.min(100, score);
  }

  /**
   * Suggest next actions for opportunity
   */
  async suggestNextActions(opportunityId) {
    const opp = await this.notionAgent.execute({
      type: 'get_page',
      data: { pageId: opportunityId }
    });

    const stage = opp.properties.Stage?.select?.name;

    const actions = {
      'Demo Scheduled': [
        'Send pre-demo materials and agenda',
        'Research prospect\'s pain points',
        'Prepare custom demo environment'
      ],
      'Demo Completed': [
        'Send follow-up email with recording',
        'Schedule proposal discussion',
        'Prepare pricing proposal'
      ],
      'Proposal Sent': [
        'Follow up within 24 hours',
        'Schedule Q&A call',
        'Address any concerns'
      ],
      'Negotiation': [
        'Review contract terms',
        'Prepare for final pricing discussion',
        'Get legal review'
      ]
    };

    return actions[stage] || ['Update opportunity status', 'Schedule next touchpoint'];
  }

  /**
   * Sync pipeline from Notion
   */
  async syncPipelineFromNotion() {
    this.log('info', 'Syncing pipeline from Notion');

    const results = await this.notionAgent.execute({
      type: 'query_database',
      data: {
        databaseId: this.databases.salesPipeline
      }
    });

    // Refresh metrics cache
    await this.getPipelineMetrics(true);

    return {
      synced: results.count,
      lastSync: new Date().toISOString()
    };
  }

  /**
   * Notify team via Zapier
   */
  async notifyTeam(event, details) {
    this.log('info', 'Notifying team', { event });

    await this.zapierAgent.execute({
      type: 'trigger_webhook',
      data: {
        webhookUrl: process.env.ZAPIER_SALES_NOTIFICATIONS_WEBHOOK,
        payload: {
          event,
          details,
          timestamp: new Date().toISOString()
        }
      }
    });
  }

  // ============================================
  // Helper Methods
  // ============================================

  getStageProbability(stage) {
    const probabilities = {
      'Lead': 10,
      'Qualified': 20,
      'Demo Scheduled': 30,
      'Demo Completed': 40,
      'Proposal Sent': 60,
      'Negotiation': 80,
      'Closed Won': 100,
      'Closed Lost': 0
    };
    return probabilities[stage] || 10;
  }

  getEndDate(period) {
    const now = new Date();
    switch (period) {
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() + 1, 0);
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      case 'year':
        return new Date(now.getFullYear(), 11, 31);
      default:
        return new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
  }

  getPeriodDates(period) {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
    }

    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  }

  buildNotionProperties(updates) {
    const properties = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (typeof value === 'string') {
        properties[key] = {
          rich_text: [{ type: 'text', text: { content: value } }]
        };
      } else if (typeof value === 'number') {
        properties[key] = { number: value };
      } else if (value instanceof Date) {
        properties[key] = { date: { start: value.toISOString() } };
      }
    });

    return properties;
  }

  buildNotionFilter(filters) {
    // Convert simple filters to Notion filter format
    const notionFilter = {};

    if (filters.status) {
      notionFilter.or = filters.status.map(status => ({
        property: 'Status',
        select: { equals: status }
      }));
    }

    return notionFilter;
  }

  parseNotionPage(page) {
    // Parse Notion page to simple object
    const props = page.properties;

    return {
      id: page.id,
      name: props.Name?.title[0]?.text?.content,
      status: props.Status?.select?.name,
      value: props.Value?.number,
      estimatedValue: props.EstimatedValue?.number,
      email: props.Email?.email,
      phone: props.Phone?.phone_number,
      contactName: props.Contact?.rich_text[0]?.text?.content,
      companyName: props.CompanyName?.rich_text[0]?.text?.content,
      industry: props.Industry?.select?.name,
      source: props.Source?.select?.name,
      type: props.Type?.select?.name
    };
  }

  async createReportPage(report) {
    // Create formatted report page in Notion
    const content = `
# Sales Report - ${report.period}
**Period:** ${report.startDate} to ${report.endDate}

## Key Metrics
- **Revenue:** $${report.metrics.revenue.toLocaleString()}
- **Deals Won:** ${report.metrics.dealsWon}
- **Conversion Rate:** ${report.metrics.conversionRate.toFixed(1)}%
- **Average Deal Size:** $${report.metrics.averageDealSize.toLocaleString()}
- **Pipeline Value:** $${report.metrics.totalValue.toLocaleString()}
- **Weighted Value:** $${report.metrics.weightedValue.toLocaleString()}

## Forecast
- **Conservative:** $${report.forecast.conservative.toLocaleString()}
- **Realistic:** $${report.forecast.realistic.toLocaleString()}
- **Optimistic:** $${report.forecast.optimistic.toLocaleString()}

## Top Deals
${report.topDeals.map(d => `- ${d.name}: $${d.value.toLocaleString()}`).join('\n')}
    `;

    // Create in Notion (you'd need a reports database)
    // await this.notionAgent.createTextPage(reportsParentId, `Sales Report ${report.period}`, content);
  }

  /**
   * Get metrics for reporting
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();

    return {
      ...baseMetrics,
      pipeline: {
        totalValue: this.pipelineMetrics.totalValue,
        weightedValue: this.pipelineMetrics.weightedValue,
        conversionRate: this.pipelineMetrics.conversionRate,
        averageDealSize: this.pipelineMetrics.averageDealSize
      }
    };
  }
}

module.exports = SalesAgent;
