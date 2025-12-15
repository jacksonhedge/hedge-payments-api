const Agent = require('../base/Agent');
const logger = require('../../utils/logger');

/**
 * User Adoption Agent
 *
 * Manages fraternity partnership program and user adoption
 * Tracks 2,000+ fraternities across US (500K+ potential users)
 * Coordinates "trade" deals: fraternity access for Hedge/Bankroll adoption
 * Reports to SalesAgent
 */
class UserAdoptionAgent extends Agent {
  constructor(config) {
    super({
      name: 'UserAdoptionAgent',
      type: 'adoption',
      team: 'SalesManagement',
      managedBy: 'SalesAgent',
      ...config
    });

    this.notionAgent = config.notionAgent;
    this.zapierAgent = config.zapierAgent;
    this.salesAgent = config.salesAgent;
    this.db = config.db;

    // Notion database IDs
    this.databases = {
      fraternities: config.fraternitiesDatabaseId,
      chapters: config.chaptersDatabaseId,
      adoptionMetrics: config.adoptionMetricsDatabaseId,
      campaigns: config.campaignsDatabaseId
    };

    // Fraternity network stats
    this.networkStats = {
      totalFraternities: 2000,
      estimatedMembers: 500000,
      averageMembersPerChapter: 250,
      partneredFraternities: 0,
      activeUsers: 0,
      adoptionRate: 0
    };

    // Adoption metrics
    this.metrics = {
      totalSignups: 0,
      activeUsers: 0,
      viralCoefficient: 0,
      topPerformingChapters: [],
      averageTimeToFirstTransaction: 0
    };

    logger.info('UserAdoptionAgent initialized');
  }

  /**
   * Perform task
   */
  async performTask(task) {
    const { data } = task;

    switch (task.type) {
      // Fraternity Partnership Management
      case 'create_fraternity_partnership':
        return await this.createFraternityPartnership(data.fraternity);

      case 'update_fraternity_status':
        return await this.updateFraternityStatus(data.fraternityId, data.status);

      case 'get_fraternity':
        return await this.getFraternity(data.fraternityId);

      case 'get_all_fraternities':
        return await this.getAllFraternities(data.filters);

      case 'activate_chapter':
        return await this.activateChapter(data.chapterId, data.tradeDetails);

      // User Adoption Tracking
      case 'track_signup':
        return await this.trackSignup(data.userId, data.fraternityId, data.chapterId);

      case 'track_first_transaction':
        return await this.trackFirstTransaction(data.userId, data.transactionData);

      case 'track_referral':
        return await this.trackReferral(data.referrerId, data.referredUserId);

      case 'get_adoption_metrics':
        return await this.getAdoptionMetrics(data.fraternityId, data.chapterId);

      // Campaign Management
      case 'launch_campaign':
        return await this.launchCampaign(data.campaign);

      case 'send_chapter_outreach':
        return await this.sendChapterOutreach(data.chapterId, data.message);

      case 'automate_onboarding':
        return await this.automateOnboarding(data.chapterId);

      // Analytics & Reporting
      case 'calculate_viral_coefficient':
        return await this.calculateViralCoefficient(data.chapterId);

      case 'identify_top_chapters':
        return await this.identifyTopChapters();

      case 'generate_adoption_report':
        return await this.generateAdoptionReport(data.period);

      case 'forecast_growth':
        return await this.forecastGrowth(data.assumptions);

      // Trade Management
      case 'track_trade_value':
        return await this.trackTradeValue(data.fraternityId, data.tradeDetails);

      case 'measure_trade_roi':
        return await this.measureTradeROI(data.fraternityId);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  // ============================================
  // Fraternity Partnership Management
  // ============================================

  /**
   * Create fraternity partnership in Notion
   */
  async createFraternityPartnership(fraternity) {
    this.log('info', 'Creating fraternity partnership', {
      name: fraternity.name
    });

    const properties = {
      Name: {
        title: [{ text: { content: fraternity.name } }]
      },
      Type: {
        select: { name: fraternity.type || 'Social' } // Social, Professional, Service, Honor
      },
      Status: {
        select: { name: 'Prospecting' }
      },
      TotalChapters: {
        number: fraternity.totalChapters || 0
      },
      EstimatedMembers: {
        number: fraternity.estimatedMembers || fraternity.totalChapters * 250
      },
      NationalContact: {
        rich_text: [{ type: 'text', text: { content: fraternity.contactName || '' } }]
      },
      Email: {
        email: fraternity.email
      },
      Website: {
        url: fraternity.website
      },
      TradeOffer: {
        rich_text: [{ type: 'text', text: { content: fraternity.tradeOffer || '' } }]
      },
      Priority: {
        select: { name: this.calculateFraternityPriority(fraternity) }
      }
    };

    const result = await this.notionAgent.execute({
      type: 'create_page',
      data: {
        parentId: this.databases.fraternities,
        properties
      }
    });

    this.emitEvent('adoption:fraternity_partnership_created', {
      fraternityId: result.id,
      name: fraternity.name,
      estimatedMembers: fraternity.estimatedMembers
    });

    // Notify sales team
    await this.salesAgent.execute({
      type: 'notify_team',
      data: {
        event: 'new_fraternity_partnership',
        details: {
          fraternityId: result.id,
          name: fraternity.name,
          potentialUsers: fraternity.estimatedMembers
        }
      }
    });

    return {
      fraternityId: result.id,
      estimatedUsers: fraternity.estimatedMembers,
      message: 'Fraternity partnership created'
    };
  }

  /**
   * Update fraternity partnership status
   */
  async updateFraternityStatus(fraternityId, newStatus) {
    this.log('info', 'Updating fraternity status', { fraternityId, newStatus });

    await this.notionAgent.execute({
      type: 'update_page',
      data: {
        pageId: fraternityId,
        properties: {
          Status: { select: { name: newStatus } },
          StatusUpdatedDate: { date: { start: new Date().toISOString() } }
        }
      }
    });

    // If activated, notify team
    if (newStatus === 'Active') {
      this.emitEvent('adoption:fraternity_activated', { fraternityId });

      await this.zapierAgent.execute({
        type: 'trigger_webhook',
        data: {
          webhookUrl: process.env.ZAPIER_FRATERNITY_ACTIVATION_WEBHOOK,
          payload: {
            event: 'fraternity_activated',
            fraternityId
          }
        }
      });
    }

    return { success: true, fraternityId, status: newStatus };
  }

  /**
   * Get fraternity details
   */
  async getFraternity(fraternityId) {
    const fraternity = await this.notionAgent.execute({
      type: 'get_page',
      data: { pageId: fraternityId }
    });

    // Get adoption metrics
    const metrics = await this.getAdoptionMetrics(fraternityId);

    return {
      ...this.parseFraternityPage(fraternity),
      metrics
    };
  }

  /**
   * Get all fraternities
   */
  async getAllFraternities(filters = {}) {
    this.log('info', 'Getting all fraternities', { filters });

    const notionFilter = {};
    if (filters.status) {
      notionFilter.property = 'Status';
      notionFilter.select = { equals: filters.status };
    }

    const results = await this.notionAgent.execute({
      type: 'query_database',
      data: {
        databaseId: this.databases.fraternities,
        filter: notionFilter,
        sorts: [
          {
            property: 'Priority',
            direction: 'ascending'
          },
          {
            property: 'EstimatedMembers',
            direction: 'descending'
          }
        ]
      }
    });

    return {
      fraternities: results.results.map(f => this.parseFraternityPage(f)),
      count: results.count
    };
  }

  /**
   * Activate a chapter with trade details
   */
  async activateChapter(chapterId, tradeDetails) {
    this.log('info', 'Activating chapter', { chapterId });

    // Create chapter record in Notion
    const properties = {
      ChapterId: {
        title: [{ text: { content: chapterId } }]
      },
      Status: {
        select: { name: 'Active' }
      },
      ActivationDate: {
        date: { start: new Date().toISOString() }
      },
      TradeDetails: {
        rich_text: [{ type: 'text', text: { content: JSON.stringify(tradeDetails) } }]
      },
      ExpectedMembers: {
        number: tradeDetails.expectedMembers || 250
      }
    };

    const result = await this.notionAgent.execute({
      type: 'create_page',
      data: {
        parentId: this.databases.chapters,
        properties
      }
    });

    // Track trade value
    await this.trackTradeValue(tradeDetails.fraternityId, tradeDetails);

    this.emitEvent('adoption:chapter_activated', {
      chapterId,
      expectedMembers: tradeDetails.expectedMembers
    });

    // Launch onboarding campaign
    await this.automateOnboarding(chapterId);

    return {
      chapterId: result.id,
      status: 'Active',
      message: 'Chapter activated successfully'
    };
  }

  // ============================================
  // User Adoption Tracking
  // ============================================

  /**
   * Track user signup from fraternity
   */
  async trackSignup(userId, fraternityId, chapterId) {
    this.log('info', 'Tracking signup', { userId, fraternityId, chapterId });

    // Record in database
    const { data, error } = await this.db.client
      .from('user_adoptions')
      .insert({
        user_id: userId,
        fraternity_id: fraternityId,
        chapter_id: chapterId,
        signed_up_at: new Date().toISOString(),
        source: 'fraternity_partnership'
      });

    if (error) {
      this.log('error', 'Failed to track signup', { error: error.message });
      throw error;
    }

    // Update metrics
    this.metrics.totalSignups++;

    // Update Notion chapter page
    await this.updateChapterMetrics(chapterId);

    this.emitEvent('adoption:user_signed_up', {
      userId,
      fraternityId,
      chapterId
    });

    // Check if we hit milestone (every 100 signups from chapter)
    const chapterSignups = await this.getChapterSignupCount(chapterId);
    if (chapterSignups % 100 === 0) {
      await this.celebrateMilestone(chapterId, chapterSignups);
    }

    return {
      success: true,
      userId,
      totalSignupsFromChapter: chapterSignups
    };
  }

  /**
   * Track first transaction (activation event)
   */
  async trackFirstTransaction(userId, transactionData) {
    this.log('info', 'Tracking first transaction', { userId });

    // Get user's adoption record
    const { data: adoption } = await this.db.client
      .from('user_adoptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!adoption) {
      this.log('warn', 'No adoption record found', { userId });
      return { success: false, message: 'User not from fraternity program' };
    }

    // Update with first transaction
    await this.db.client
      .from('user_adoptions')
      .update({
        first_transaction_at: new Date().toISOString(),
        first_transaction_amount: transactionData.amount,
        activated: true
      })
      .eq('user_id', userId);

    // Calculate time to activation
    const timeToActivation = new Date() - new Date(adoption.signed_up_at);
    const hoursToActivation = timeToActivation / (1000 * 60 * 60);

    this.emitEvent('adoption:user_activated', {
      userId,
      chapterId: adoption.chapter_id,
      hoursToActivation
    });

    // Update chapter metrics
    await this.updateChapterMetrics(adoption.chapter_id);

    return {
      success: true,
      activated: true,
      hoursToActivation
    };
  }

  /**
   * Track referral (viral loop)
   */
  async trackReferral(referrerId, referredUserId) {
    this.log('info', 'Tracking referral', { referrerId, referredUserId });

    // Get referrer's adoption record
    const { data: referrer } = await this.db.client
      .from('user_adoptions')
      .select('*')
      .eq('user_id', referrerId)
      .single();

    if (!referrer) {
      return { success: false, message: 'Referrer not from fraternity program' };
    }

    // Create referred user adoption record
    await this.db.client
      .from('user_adoptions')
      .insert({
        user_id: referredUserId,
        fraternity_id: referrer.fraternity_id,
        chapter_id: referrer.chapter_id,
        referred_by: referrerId,
        signed_up_at: new Date().toISOString(),
        source: 'referral'
      });

    // Increment referrer's referral count
    await this.db.client
      .from('user_adoptions')
      .update({
        referral_count: (referrer.referral_count || 0) + 1
      })
      .eq('user_id', referrerId);

    this.emitEvent('adoption:referral_made', {
      referrerId,
      referredUserId,
      chapterId: referrer.chapter_id
    });

    return {
      success: true,
      referralCount: (referrer.referral_count || 0) + 1
    };
  }

  /**
   * Get adoption metrics for fraternity or chapter
   */
  async getAdoptionMetrics(fraternityId, chapterId = null) {
    this.log('info', 'Getting adoption metrics', { fraternityId, chapterId });

    let query = this.db.client
      .from('user_adoptions')
      .select('*')
      .eq('fraternity_id', fraternityId);

    if (chapterId) {
      query = query.eq('chapter_id', chapterId);
    }

    const { data: adoptions, error } = await query;

    if (error) {
      this.log('error', 'Failed to get metrics', { error: error.message });
      throw error;
    }

    const metrics = {
      totalSignups: adoptions.length,
      activeUsers: adoptions.filter(a => a.activated).length,
      activationRate: (adoptions.filter(a => a.activated).length / adoptions.length) * 100,
      totalReferrals: adoptions.reduce((sum, a) => sum + (a.referral_count || 0), 0),
      averageReferralsPerUser: adoptions.reduce((sum, a) => sum + (a.referral_count || 0), 0) / adoptions.length,
      viralCoefficient: this.calculateViralCoefficientFromData(adoptions)
    };

    return metrics;
  }

  // ============================================
  // Campaign Management
  // ============================================

  /**
   * Launch adoption campaign for fraternity/chapter
   */
  async launchCampaign(campaign) {
    this.log('info', 'Launching campaign', { name: campaign.name });

    const properties = {
      Name: {
        title: [{ text: { content: campaign.name } }]
      },
      Type: {
        select: { name: campaign.type } // 'Onboarding', 'Referral', 'Activation'
      },
      TargetFraternity: {
        relation: [{ id: campaign.fraternityId }]
      },
      TargetChapter: {
        rich_text: [{ type: 'text', text: { content: campaign.chapterId || 'All' } }]
      },
      StartDate: {
        date: { start: campaign.startDate || new Date().toISOString() }
      },
      Status: {
        select: { name: 'Active' }
      },
      Goal: {
        rich_text: [{ type: 'text', text: { content: campaign.goal } }]
      }
    };

    const result = await this.notionAgent.execute({
      type: 'create_page',
      data: {
        parentId: this.databases.campaigns,
        properties
      }
    });

    // Trigger Zapier workflow for campaign
    await this.zapierAgent.execute({
      type: 'trigger_webhook',
      data: {
        webhookUrl: process.env.ZAPIER_CAMPAIGN_LAUNCH_WEBHOOK,
        payload: {
          event: 'campaign_launched',
          campaign: {
            id: result.id,
            ...campaign
          }
        }
      }
    });

    this.emitEvent('adoption:campaign_launched', {
      campaignId: result.id,
      name: campaign.name
    });

    return {
      campaignId: result.id,
      status: 'Active',
      message: 'Campaign launched successfully'
    };
  }

  /**
   * Send outreach to chapter leadership
   */
  async sendChapterOutreach(chapterId, message) {
    this.log('info', 'Sending chapter outreach', { chapterId });

    // Get chapter contact info
    const chapter = await this.notionAgent.execute({
      type: 'get_page',
      data: { pageId: chapterId }
    });

    // Send via Zapier (email/SMS)
    await this.zapierAgent.execute({
      type: 'trigger_webhook',
      data: {
        webhookUrl: process.env.ZAPIER_CHAPTER_OUTREACH_WEBHOOK,
        payload: {
          event: 'chapter_outreach',
          chapterId,
          message,
          chapter: this.parseChapterPage(chapter)
        }
      }
    });

    return {
      success: true,
      chapterId,
      message: 'Outreach sent'
    };
  }

  /**
   * Automate onboarding for new chapter
   */
  async automateOnboarding(chapterId) {
    this.log('info', 'Automating onboarding', { chapterId });

    // Launch onboarding campaign
    const campaign = await this.launchCampaign({
      name: `${chapterId} Onboarding`,
      type: 'Onboarding',
      chapterId,
      goal: 'Get 80% of chapter members signed up',
      startDate: new Date().toISOString()
    });

    // Send welcome email to chapter president
    await this.sendChapterOutreach(chapterId, {
      type: 'welcome',
      subject: 'Welcome to Bankroll! Here\'s how to get your chapter onboarded',
      template: 'chapter_welcome'
    });

    // Schedule follow-up emails (Day 3, Day 7, Day 14)
    await this.scheduleFollowUps(chapterId, [3, 7, 14]);

    return {
      success: true,
      campaignId: campaign.campaignId,
      message: 'Onboarding campaign started'
    };
  }

  /**
   * Schedule follow-up emails
   */
  async scheduleFollowUps(chapterId, daysArray) {
    for (const days of daysArray) {
      await this.zapierAgent.execute({
        type: 'trigger_webhook',
        data: {
          webhookUrl: process.env.ZAPIER_SCHEDULE_WEBHOOK,
          payload: {
            event: 'schedule_follow_up',
            chapterId,
            delayDays: days,
            message: {
              type: 'follow_up',
              subject: `Day ${days}: How is Bankroll adoption going?`,
              template: `follow_up_day_${days}`
            }
          }
        }
      });
    }

    return { scheduled: daysArray.length };
  }

  // ============================================
  // Analytics & Reporting
  // ============================================

  /**
   * Calculate viral coefficient for chapter
   */
  async calculateViralCoefficient(chapterId) {
    this.log('info', 'Calculating viral coefficient', { chapterId });

    const { data: adoptions } = await this.db.client
      .from('user_adoptions')
      .select('*')
      .eq('chapter_id', chapterId);

    const coefficient = this.calculateViralCoefficientFromData(adoptions);

    return {
      chapterId,
      viralCoefficient: coefficient,
      interpretation: coefficient > 1
        ? 'Viral! Each user brings more than 1 new user'
        : 'Sub-viral. Need to improve referral incentives'
    };
  }

  calculateViralCoefficientFromData(adoptions) {
    if (!adoptions || adoptions.length === 0) return 0;

    // Viral Coefficient = (Total Referrals) / (Total Original Users)
    const originalUsers = adoptions.filter(a => !a.referred_by).length;
    const totalReferrals = adoptions.reduce((sum, a) => sum + (a.referral_count || 0), 0);

    return originalUsers > 0 ? totalReferrals / originalUsers : 0;
  }

  /**
   * Identify top performing chapters
   */
  async identifyTopChapters() {
    this.log('info', 'Identifying top chapters');

    // Get all chapters with metrics
    const { data: chapters } = await this.db.client
      .from('user_adoptions')
      .select('chapter_id, COUNT(*) as signup_count, SUM(CASE WHEN activated THEN 1 ELSE 0 END) as active_count')
      .groupBy('chapter_id')
      .orderBy('active_count', { ascending: false })
      .limit(10);

    const topChapters = await Promise.all(
      chapters.map(async (chapter) => {
        const metrics = await this.getAdoptionMetrics(null, chapter.chapter_id);
        return {
          chapterId: chapter.chapter_id,
          signupCount: chapter.signup_count,
          activeCount: chapter.active_count,
          viralCoefficient: metrics.viralCoefficient
        };
      })
    );

    this.metrics.topPerformingChapters = topChapters;

    return {
      topChapters,
      message: 'Top performing chapters identified'
    };
  }

  /**
   * Generate adoption report
   */
  async generateAdoptionReport(period = 'month') {
    this.log('info', 'Generating adoption report', { period });

    const { startDate, endDate } = this.getPeriodDates(period);

    // Get signups in period
    const { data: signups } = await this.db.client
      .from('user_adoptions')
      .select('*')
      .gte('signed_up_at', startDate)
      .lte('signed_up_at', endDate);

    // Calculate metrics
    const totalSignups = signups.length;
    const activated = signups.filter(s => s.activated).length;
    const activationRate = (activated / totalSignups) * 100;

    // Get top chapters
    const topChapters = await this.identifyTopChapters();

    // Calculate overall viral coefficient
    const { data: allAdoptions } = await this.db.client
      .from('user_adoptions')
      .select('*');

    const viralCoefficient = this.calculateViralCoefficientFromData(allAdoptions);

    const report = {
      period,
      startDate,
      endDate,
      metrics: {
        totalSignups,
        activated,
        activationRate,
        viralCoefficient,
        topChapters: topChapters.topChapters.slice(0, 5)
      },
      networkStats: {
        ...this.networkStats,
        activeUsers: allAdoptions.filter(a => a.activated).length,
        adoptionRate: (allAdoptions.length / this.networkStats.estimatedMembers) * 100
      }
    };

    // Create report page in Notion
    await this.createAdoptionReportPage(report);

    // Send to sales agent
    this.emitEvent('adoption:report_generated', report);

    // Send to team via Zapier
    await this.zapierAgent.execute({
      type: 'trigger_webhook',
      data: {
        webhookUrl: process.env.ZAPIER_ADOPTION_REPORT_WEBHOOK,
        payload: {
          event: 'adoption_report_generated',
          report
        }
      }
    });

    return report;
  }

  /**
   * Forecast growth based on assumptions
   */
  async forecastGrowth(assumptions = {}) {
    this.log('info', 'Forecasting growth', { assumptions });

    const {
      currentUsers = 0,
      viralCoefficient = 1.2,
      cycleTimeDays = 7,
      forecastMonths = 12
    } = assumptions;

    const forecast = [];
    let users = currentUsers;

    for (let month = 0; month <= forecastMonths; month++) {
      const cyclesPerMonth = 30 / cycleTimeDays;
      const newUsers = users * Math.pow(viralCoefficient, cyclesPerMonth);

      forecast.push({
        month,
        users: Math.round(newUsers),
        growth: month === 0 ? 0 : ((newUsers - users) / users) * 100
      });

      users = newUsers;
    }

    return {
      assumptions,
      forecast,
      finalUsers: forecast[forecastMonths].users,
      totalGrowth: ((forecast[forecastMonths].users - currentUsers) / currentUsers) * 100
    };
  }

  // ============================================
  // Trade Management
  // ============================================

  /**
   * Track trade value for fraternity partnership
   */
  async trackTradeValue(fraternityId, tradeDetails) {
    this.log('info', 'Tracking trade value', { fraternityId });

    // What we're offering in exchange for adoption
    const tradeValue = {
      fraternityId,
      offering: tradeDetails.offering, // e.g., "Access to Fraternity Base platform for chapter management"
      estimatedValue: tradeDetails.estimatedValue, // e.g., $5000/year
      expectedUsers: tradeDetails.expectedUsers,
      startDate: new Date().toISOString()
    };

    // Store in Notion
    await this.notionAgent.execute({
      type: 'update_page',
      data: {
        pageId: fraternityId,
        properties: {
          TradeValue: { number: tradeValue.estimatedValue },
          TradeOffering: {
            rich_text: [{ type: 'text', text: { content: tradeValue.offering } }]
          }
        }
      }
    });

    return tradeValue;
  }

  /**
   * Measure ROI of trade deal
   */
  async measureTradeROI(fraternityId) {
    this.log('info', 'Measuring trade ROI', { fraternityId });

    // Get fraternity details and trade value
    const fraternity = await this.getFraternity(fraternityId);
    const tradeValue = fraternity.tradeValue || 0;

    // Get adoption metrics
    const metrics = await this.getAdoptionMetrics(fraternityId);

    // Calculate revenue from these users
    // Assume $1 average transaction fee, 2 transactions per month
    const monthlyRevenuePerUser = 2;
    const monthlyRevenue = metrics.activeUsers * monthlyRevenuePerUser;
    const annualRevenue = monthlyRevenue * 12;

    // Calculate ROI
    const roi = tradeValue > 0
      ? ((annualRevenue - tradeValue) / tradeValue) * 100
      : Infinity;

    const paybackMonths = tradeValue > 0
      ? tradeValue / monthlyRevenue
      : 0;

    return {
      fraternityId,
      tradeValue,
      metrics,
      revenue: {
        monthly: monthlyRevenue,
        annual: annualRevenue
      },
      roi,
      paybackMonths,
      profitable: annualRevenue > tradeValue
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  calculateFraternityPriority(fraternity) {
    // Prioritize based on size and engagement potential
    if (fraternity.estimatedMembers > 10000) return 'High';
    if (fraternity.estimatedMembers > 5000) return 'Medium';
    return 'Low';
  }

  parseFraternityPage(page) {
    const props = page.properties;
    return {
      id: page.id,
      name: props.Name?.title[0]?.text?.content,
      type: props.Type?.select?.name,
      status: props.Status?.select?.name,
      totalChapters: props.TotalChapters?.number,
      estimatedMembers: props.EstimatedMembers?.number,
      contactName: props.NationalContact?.rich_text[0]?.text?.content,
      email: props.Email?.email,
      website: props.Website?.url,
      tradeOffer: props.TradeOffer?.rich_text[0]?.text?.content,
      priority: props.Priority?.select?.name
    };
  }

  parseChapterPage(page) {
    const props = page.properties;
    return {
      id: page.id,
      chapterId: props.ChapterId?.title[0]?.text?.content,
      status: props.Status?.select?.name,
      activationDate: props.ActivationDate?.date?.start,
      expectedMembers: props.ExpectedMembers?.number
    };
  }

  async updateChapterMetrics(chapterId) {
    const metrics = await this.getAdoptionMetrics(null, chapterId);

    await this.notionAgent.execute({
      type: 'update_page',
      data: {
        pageId: chapterId,
        properties: {
          TotalSignups: { number: metrics.totalSignups },
          ActiveUsers: { number: metrics.activeUsers },
          ActivationRate: { number: metrics.activationRate },
          ViralCoefficient: { number: metrics.viralCoefficient }
        }
      }
    });
  }

  async getChapterSignupCount(chapterId) {
    const { count } = await this.db.client
      .from('user_adoptions')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', chapterId);

    return count || 0;
  }

  async celebrateMilestone(chapterId, signupCount) {
    this.log('info', 'Milestone reached!', { chapterId, signupCount });

    await this.zapierAgent.execute({
      type: 'trigger_webhook',
      data: {
        webhookUrl: process.env.ZAPIER_MILESTONE_WEBHOOK,
        payload: {
          event: 'milestone_reached',
          chapterId,
          signupCount,
          message: `🎉 ${chapterId} just hit ${signupCount} signups!`
        }
      }
    });
  }

  async createAdoptionReportPage(report) {
    const content = `
# Adoption Report - ${report.period}
**Period:** ${report.startDate} to ${report.endDate}

## Key Metrics
- **Total Signups:** ${report.metrics.totalSignups}
- **Activated Users:** ${report.metrics.activated}
- **Activation Rate:** ${report.metrics.activationRate.toFixed(1)}%
- **Viral Coefficient:** ${report.metrics.viralCoefficient.toFixed(2)}

## Network Stats
- **Total Active Users:** ${report.networkStats.activeUsers}
- **Adoption Rate:** ${report.networkStats.adoptionRate.toFixed(2)}%
- **Potential Users:** ${report.networkStats.estimatedMembers}

## Top Chapters
${report.metrics.topChapters.map(c => `- ${c.chapterId}: ${c.activeCount} active users (VC: ${c.viralCoefficient.toFixed(2)})`).join('\n')}
    `;

    // Create in Notion
    // await this.notionAgent.createTextPage(reportsParentId, `Adoption Report ${report.period}`, content);
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
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  /**
   * Get metrics for reporting
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();

    return {
      ...baseMetrics,
      adoption: {
        totalSignups: this.metrics.totalSignups,
        activeUsers: this.metrics.activeUsers,
        viralCoefficient: this.metrics.viralCoefficient,
        topChapters: this.metrics.topPerformingChapters.slice(0, 3)
      },
      network: this.networkStats
    };
  }
}

module.exports = UserAdoptionAgent;
