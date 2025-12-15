const Agent = require('../base/Agent');
const logger = require('../../utils/logger');

/**
 * Product Roadmap Agent
 *
 * Manages product roadmap in Notion
 * Syncs with network analytics to prioritize features
 * Tracks progress and generates reports
 */
class ProductRoadmapAgent extends Agent {
  constructor(config) {
    super({
      name: 'ProductRoadmapAgent',
      type: 'product_management',
      team: 'ProductManagement',
      ...config
    });

    this.notionTools = config.notionTools; // MCP Notion tools
    this.db = config.db; // Supabase connection
    this.roadmapDatabaseId = config.roadmapDatabaseId; // Notion database ID

    logger.info('ProductRoadmapAgent initialized');
  }

  /**
   * Perform task
   */
  async performTask(task) {
    switch (task.type) {
      case 'sync_roadmap':
        return await this.syncRoadmap();

      case 'update_feature_status':
        return await this.updateFeatureStatus(task.data.featureId, task.data.status);

      case 'prioritize_features':
        return await this.prioritizeFeatures();

      case 'generate_weekly_report':
        return await this.generateWeeklyReport();

      case 'create_feature':
        return await this.createFeature(task.data);

      case 'track_network_impact':
        return await this.trackNetworkImpact(task.data.featureId);

      case 'get_roadmap_status':
        return await this.getRoadmapStatus();

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Sync roadmap with Notion database
   */
  async syncRoadmap() {
    this.log('info', 'Syncing roadmap with Notion');

    if (!this.roadmapDatabaseId) {
      throw new Error('Notion roadmap database ID not configured');
    }

    // Query all roadmap items
    const response = await this.notionTools['mcp__notion__API-post-database-query']({
      database_id: this.roadmapDatabaseId,
      sorts: [
        {
          property: 'Priority',
          direction: 'ascending'
        }
      ]
    });

    const features = response.results.map(page => this.parseNotionPage(page));

    this.log('info', 'Roadmap synced', { featureCount: features.length });

    return {
      features,
      summary: {
        total: features.length,
        inProgress: features.filter(f => f.status === 'In Progress').length,
        completed: features.filter(f => f.status === 'Done').length,
        planned: features.filter(f => f.status === 'Planned').length,
        blocked: features.filter(f => f.status === 'Blocked').length
      }
    };
  }

  /**
   * Update feature status in Notion
   */
  async updateFeatureStatus(featureId, status) {
    this.log('info', 'Updating feature status', { featureId, status });

    await this.notionTools['mcp__notion__API-patch-page']({
      page_id: featureId,
      properties: {
        Status: {
          status: {
            name: status
          }
        },
        'Last Updated': {
          date: {
            start: new Date().toISOString()
          }
        }
      }
    });

    this.emitEvent('roadmap:feature_updated', {
      featureId,
      status
    });

    return { success: true, featureId, status };
  }

  /**
   * Prioritize features based on network growth impact
   */
  async prioritizeFeatures() {
    this.log('info', 'Prioritizing features based on network impact');

    // Get current roadmap
    const roadmap = await this.syncRoadmap();

    // Get network analytics
    const analytics = await this.getNetworkAnalytics();

    // Score each feature
    const scoredFeatures = roadmap.features.map(feature => {
      const score = this.calculateFeatureScore(feature, analytics);
      return { ...feature, score };
    });

    // Sort by score
    scoredFeatures.sort((a, b) => b.score - a.score);

    // Update priorities in Notion
    for (let i = 0; i < scoredFeatures.length; i++) {
      const feature = scoredFeatures[i];
      const newPriority = i + 1;

      if (feature.priority !== newPriority) {
        await this.updateFeaturePriority(feature.id, newPriority);
      }
    }

    return {
      features: scoredFeatures,
      message: 'Features re-prioritized based on network impact'
    };
  }

  /**
   * Calculate feature score based on network impact
   */
  calculateFeatureScore(feature, analytics) {
    let score = 0;

    // Base score on category impact
    const categoryScores = {
      'Network Growth': 10,
      'Internal Transfer Optimization': 9,
      'User Acquisition': 8,
      'Merchant Acquisition': 8,
      'Cost Reduction': 7,
      'UX Improvement': 6,
      'Compliance': 5,
      'Infrastructure': 4
    };

    score += categoryScores[feature.category] || 5;

    // Boost if feature helps increase network %
    if (feature.category === 'Network Growth' || feature.category === 'Internal Transfer Optimization') {
      const currentNetworkPct = analytics.networkPercentage || 0;
      if (currentNetworkPct < 70) {
        score += 5; // Prioritize network growth if below 70%
      }
    }

    // Boost if feature helps user acquisition
    if (feature.category === 'User Acquisition' && analytics.userGrowthRate < 10) {
      score += 3; // Need more users
    }

    // Boost if feature helps merchant acquisition
    if (feature.category === 'Merchant Acquisition' && analytics.merchantCount < 100) {
      score += 3; // Need more merchants
    }

    // Reduce score for blocked items
    if (feature.status === 'Blocked') {
      score -= 5;
    }

    // Boost items already in progress (don't context switch)
    if (feature.status === 'In Progress') {
      score += 2;
    }

    // Effort penalty (prefer quick wins)
    if (feature.effort === 'Large') {
      score -= 2;
    } else if (feature.effort === 'Small') {
      score += 1;
    }

    return score;
  }

  /**
   * Generate weekly progress report
   */
  async generateWeeklyReport() {
    this.log('info', 'Generating weekly report');

    const roadmap = await this.syncRoadmap();
    const analytics = await this.getNetworkAnalytics();

    // Get completed features this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const completedThisWeek = roadmap.features.filter(f =>
      f.status === 'Done' && new Date(f.completedDate) > oneWeekAgo
    );

    // Get features in progress
    const inProgress = roadmap.features.filter(f => f.status === 'In Progress');

    // Get blocked features
    const blocked = roadmap.features.filter(f => f.status === 'Blocked');

    const report = {
      week: this.getWeekNumber(),
      date: new Date().toISOString(),

      // Roadmap status
      roadmap: {
        totalFeatures: roadmap.features.length,
        completed: roadmap.summary.completed,
        inProgress: roadmap.summary.inProgress,
        planned: roadmap.summary.planned,
        blocked: roadmap.summary.blocked
      },

      // This week's progress
      thisWeek: {
        completedFeatures: completedThisWeek.length,
        features: completedThisWeek.map(f => ({
          name: f.name,
          category: f.category,
          completedDate: f.completedDate
        })),
        inProgressFeatures: inProgress.map(f => ({
          name: f.name,
          category: f.category,
          progress: f.progress || 0
        })),
        blockedFeatures: blocked.map(f => ({
          name: f.name,
          category: f.category,
          blockedReason: f.blockedReason
        }))
      },

      // Network metrics
      networkMetrics: {
        networkPercentage: analytics.networkPercentage?.toFixed(1) + '%',
        totalVolume: '$' + analytics.totalVolume?.toLocaleString(),
        profitMargin: analytics.profitMargin?.toFixed(1) + '%',
        activeUsers: analytics.activeUsers,
        activeMerchants: analytics.activeMerchants,
        weeklyGrowth: analytics.weeklyGrowth
      },

      // Key insights
      insights: this.generateInsights(roadmap, analytics),

      // Next week priorities
      nextWeek: {
        topPriorities: roadmap.features
          .filter(f => f.status !== 'Done' && f.status !== 'Blocked')
          .slice(0, 5)
          .map(f => ({
            name: f.name,
            category: f.category,
            priority: f.priority
          }))
      }
    };

    // Post report to Notion
    await this.postReportToNotion(report);

    this.emitEvent('roadmap:weekly_report', report);

    return report;
  }

  /**
   * Generate insights from data
   */
  generateInsights(roadmap, analytics) {
    const insights = [];

    // Network percentage insight
    const networkPct = analytics.networkPercentage || 0;
    if (networkPct < 50) {
      insights.push({
        type: 'warning',
        message: `Network percentage is ${networkPct.toFixed(1)}%. Focus on features that increase internal transfers.`,
        recommendation: 'Prioritize merchant acquisition and user education features'
      });
    } else if (networkPct > 70) {
      insights.push({
        type: 'success',
        message: `Excellent network effect! ${networkPct.toFixed(1)}% of transactions are internal.`,
        recommendation: 'Continue optimizing margins and user experience'
      });
    }

    // Feature velocity insight
    const completedCount = roadmap.summary.completed;
    const totalCount = roadmap.features.length;
    const completionRate = (completedCount / totalCount * 100).toFixed(0);

    insights.push({
      type: 'info',
      message: `${completionRate}% of roadmap features completed (${completedCount}/${totalCount})`,
      recommendation: completionRate < 50 ? 'Consider breaking down large features' : 'Great progress!'
    });

    // Blocked features insight
    if (roadmap.summary.blocked > 0) {
      insights.push({
        type: 'warning',
        message: `${roadmap.summary.blocked} features are blocked`,
        recommendation: 'Review blocked items and resolve dependencies'
      });
    }

    // Profit margin insight
    const profitMargin = analytics.profitMargin || 0;
    if (profitMargin < 30) {
      insights.push({
        type: 'warning',
        message: `Profit margin is ${profitMargin.toFixed(1)}%. Too much external volume.`,
        recommendation: 'Focus on increasing internal network transactions'
      });
    } else if (profitMargin > 60) {
      insights.push({
        type: 'success',
        message: `Strong profit margin of ${profitMargin.toFixed(1)}%!`,
        recommendation: 'Network effect is working!'
      });
    }

    return insights;
  }

  /**
   * Create new feature in roadmap
   */
  async createFeature(featureData) {
    this.log('info', 'Creating new feature', { name: featureData.name });

    const response = await this.notionTools['mcp__notion__API-post-page']({
      parent: {
        database_id: this.roadmapDatabaseId
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: featureData.name
              }
            }
          ]
        },
        Status: {
          status: {
            name: featureData.status || 'Planned'
          }
        },
        Category: {
          select: {
            name: featureData.category || 'Other'
          }
        },
        Priority: {
          number: featureData.priority || 999
        },
        Effort: {
          select: {
            name: featureData.effort || 'Medium'
          }
        }
      }
    });

    this.emitEvent('roadmap:feature_created', {
      featureId: response.id,
      name: featureData.name
    });

    return {
      success: true,
      featureId: response.id,
      name: featureData.name
    };
  }

  /**
   * Track network impact of a feature
   */
  async trackNetworkImpact(featureId) {
    this.log('info', 'Tracking network impact', { featureId });

    // Get feature details
    const feature = await this.notionTools['mcp__notion__API-retrieve-a-page']({
      page_id: featureId
    });

    // Get network analytics before and after
    const beforeMetrics = await this.getNetworkMetricsAtDate(feature.properties.StartDate);
    const afterMetrics = await this.getNetworkAnalytics();

    const impact = {
      featureId,
      featureName: feature.properties.Name?.title[0]?.text?.content,

      networkPercentageChange: afterMetrics.networkPercentage - beforeMetrics.networkPercentage,
      volumeChange: afterMetrics.totalVolume - beforeMetrics.totalVolume,
      profitMarginChange: afterMetrics.profitMargin - beforeMetrics.profitMargin,
      userGrowth: afterMetrics.activeUsers - beforeMetrics.activeUsers,
      merchantGrowth: afterMetrics.activeMerchants - beforeMetrics.activeMerchants,

      assessment: this.assessImpact({
        networkChange: afterMetrics.networkPercentage - beforeMetrics.networkPercentage,
        volumeChange: afterMetrics.totalVolume - beforeMetrics.totalVolume
      })
    };

    // Update feature with impact data
    await this.updateFeatureImpact(featureId, impact);

    return impact;
  }

  /**
   * Assess feature impact
   */
  assessImpact({ networkChange, volumeChange }) {
    if (networkChange > 5) {
      return {
        level: 'high',
        message: 'Significant positive impact on network effect!',
        emoji: '🚀'
      };
    } else if (networkChange > 2) {
      return {
        level: 'medium',
        message: 'Positive impact on network growth',
        emoji: '✅'
      };
    } else if (volumeChange > 100000) {
      return {
        level: 'medium',
        message: 'Good volume growth',
        emoji: '📈'
      };
    } else {
      return {
        level: 'low',
        message: 'Minimal measurable impact',
        emoji: '📊'
      };
    }
  }

  /**
   * Get roadmap status summary
   */
  async getRoadmapStatus() {
    const roadmap = await this.syncRoadmap();

    return {
      summary: roadmap.summary,
      topPriorities: roadmap.features
        .filter(f => f.status !== 'Done')
        .slice(0, 5),
      recentlyCompleted: roadmap.features
        .filter(f => f.status === 'Done')
        .slice(0, 5),
      blockedItems: roadmap.features
        .filter(f => f.status === 'Blocked')
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Parse Notion page to feature object
   */
  parseNotionPage(page) {
    const props = page.properties;

    return {
      id: page.id,
      name: props.Name?.title[0]?.text?.content || 'Untitled',
      status: props.Status?.status?.name || 'Planned',
      category: props.Category?.select?.name || 'Other',
      priority: props.Priority?.number || 999,
      effort: props.Effort?.select?.name || 'Medium',
      progress: props.Progress?.number || 0,
      completedDate: props.CompletedDate?.date?.start || null,
      blockedReason: props.BlockedReason?.rich_text[0]?.text?.content || null,
      description: props.Description?.rich_text[0]?.text?.content || '',
      createdAt: page.created_time,
      updatedAt: page.last_edited_time
    };
  }

  /**
   * Get network analytics from Supabase
   */
  async getNetworkAnalytics() {
    if (!this.db) {
      // Return mock data if no DB
      return {
        networkPercentage: 65,
        totalVolume: 1500000,
        profitMargin: 45,
        activeUsers: 5000,
        activeMerchants: 50,
        userGrowthRate: 15,
        merchantCount: 50,
        weeklyGrowth: { users: 500, merchants: 5, volume: 150000 }
      };
    }

    // Get last 7 days of analytics
    const analytics = await this.db.getNetworkAnalytics(7);

    if (analytics.length === 0) {
      return this.getNetworkAnalytics(); // Return mock if no data
    }

    // Calculate averages
    const latest = analytics[0];
    const oldest = analytics[analytics.length - 1];

    return {
      networkPercentage: latest.network_percentage,
      totalVolume: latest.total_volume,
      profitMargin: latest.profit_margin,
      activeUsers: latest.active_users,
      activeMerchants: latest.active_merchants,
      userGrowthRate: ((latest.active_users - oldest.active_users) / oldest.active_users * 100),
      merchantCount: latest.active_merchants,
      weeklyGrowth: {
        users: latest.active_users - oldest.active_users,
        merchants: latest.active_merchants - oldest.active_merchants,
        volume: latest.total_volume - oldest.total_volume
      }
    };
  }

  async getNetworkMetricsAtDate(date) {
    // TODO: Implement historical metrics lookup
    return this.getNetworkAnalytics();
  }

  async updateFeaturePriority(featureId, priority) {
    await this.notionTools['mcp__notion__API-patch-page']({
      page_id: featureId,
      properties: {
        Priority: {
          number: priority
        }
      }
    });
  }

  async updateFeatureImpact(featureId, impact) {
    await this.notionTools['mcp__notion__API-patch-page']({
      page_id: featureId,
      properties: {
        'Network Impact': {
          rich_text: [
            {
              text: {
                content: `${impact.assessment.emoji} ${impact.assessment.message}\n` +
                         `Network: ${impact.networkPercentageChange > 0 ? '+' : ''}${impact.networkPercentageChange.toFixed(1)}%\n` +
                         `Volume: $${impact.volumeChange.toLocaleString()}`
              }
            }
          ]
        }
      }
    });
  }

  async postReportToNotion(report) {
    // TODO: Create a new page in Notion with the weekly report
    // For now, just log it
    this.log('info', 'Weekly report generated', { report });
  }

  getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  }
}

module.exports = ProductRoadmapAgent;
