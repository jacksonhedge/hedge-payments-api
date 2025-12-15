const Agent = require('../base/Agent');
const logger = require('../../utils/logger');

/**
 * Notion Agent
 *
 * General-purpose Notion automation agent
 * Manages Notion workspace operations, databases, and pages
 */
class NotionAgent extends Agent {
  constructor(config) {
    super({
      name: 'NotionAgent',
      type: 'automation',
      team: 'AutomationManagement',
      ...config
    });

    this.notionTools = config.notionTools; // MCP Notion tools
    this.db = config.db;

    logger.info('NotionAgent initialized');
  }

  /**
   * Perform task
   */
  async performTask(task) {
    const { data } = task;

    switch (task.type) {
      // Database operations
      case 'query_database':
        return await this.queryDatabase(data.databaseId, data.filter, data.sorts);

      case 'create_database':
        return await this.createDatabase(data.parentPageId, data.title, data.properties);

      // Page operations
      case 'create_page':
        return await this.createPage(data.parentId, data.properties, data.children);

      case 'update_page':
        return await this.updatePage(data.pageId, data.properties);

      case 'get_page':
        return await this.getPage(data.pageId);

      case 'delete_page':
        return await this.deletePage(data.pageId);

      // Block operations
      case 'append_blocks':
        return await this.appendBlocks(data.blockId, data.children);

      case 'get_block_children':
        return await this.getBlockChildren(data.blockId);

      // Search
      case 'search':
        return await this.search(data.query, data.filter);

      // Batch operations
      case 'batch_update':
        return await this.batchUpdate(data.updates);

      case 'batch_create':
        return await this.batchCreate(data.items);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Query a Notion database
   */
  async queryDatabase(databaseId, filter = {}, sorts = []) {
    this.log('info', 'Querying database', { databaseId });

    const response = await this.notionTools['mcp__notion__API-post-database-query']({
      database_id: databaseId,
      filter: filter,
      sorts: sorts
    });

    this.emitEvent('notion:database_queried', {
      databaseId,
      resultCount: response.results.length
    });

    return {
      results: response.results,
      count: response.results.length,
      hasMore: response.has_more,
      nextCursor: response.next_cursor
    };
  }

  /**
   * Create a new database
   */
  async createDatabase(parentPageId, title, properties) {
    this.log('info', 'Creating database', { title });

    const response = await this.notionTools['mcp__notion__API-create-a-database']({
      parent: {
        type: 'page_id',
        page_id: parentPageId
      },
      title: [
        {
          type: 'text',
          text: { content: title }
        }
      ],
      properties: properties
    });

    this.emitEvent('notion:database_created', {
      databaseId: response.id,
      title
    });

    return response;
  }

  /**
   * Create a new page
   */
  async createPage(parentId, properties, children = []) {
    this.log('info', 'Creating page', { parentId });

    const response = await this.notionTools['mcp__notion__API-post-page']({
      parent: {
        page_id: parentId
      },
      properties: properties,
      children: children
    });

    this.emitEvent('notion:page_created', {
      pageId: response.id,
      parentId
    });

    return response;
  }

  /**
   * Update page properties
   */
  async updatePage(pageId, properties) {
    this.log('info', 'Updating page', { pageId });

    const response = await this.notionTools['mcp__notion__API-patch-page']({
      page_id: pageId,
      properties: properties
    });

    this.emitEvent('notion:page_updated', {
      pageId
    });

    return response;
  }

  /**
   * Get page details
   */
  async getPage(pageId) {
    this.log('info', 'Getting page', { pageId });

    const response = await this.notionTools['mcp__notion__API-retrieve-a-page']({
      page_id: pageId
    });

    return response;
  }

  /**
   * Delete page (archive)
   */
  async deletePage(pageId) {
    this.log('info', 'Deleting page', { pageId });

    const response = await this.notionTools['mcp__notion__API-patch-page']({
      page_id: pageId,
      archived: true
    });

    this.emitEvent('notion:page_deleted', {
      pageId
    });

    return response;
  }

  /**
   * Append blocks to a page/block
   */
  async appendBlocks(blockId, children) {
    this.log('info', 'Appending blocks', { blockId });

    const response = await this.notionTools['mcp__notion__API-patch-block-children']({
      block_id: blockId,
      children: children
    });

    return response;
  }

  /**
   * Get block children
   */
  async getBlockChildren(blockId) {
    this.log('info', 'Getting block children', { blockId });

    const response = await this.notionTools['mcp__notion__API-get-block-children']({
      block_id: blockId
    });

    return response;
  }

  /**
   * Search Notion workspace
   */
  async search(query, filter = {}) {
    this.log('info', 'Searching', { query });

    const response = await this.notionTools['mcp__notion__API-post-search']({
      query: query,
      filter: filter
    });

    return {
      results: response.results,
      count: response.results.length
    };
  }

  /**
   * Batch update multiple pages
   */
  async batchUpdate(updates) {
    this.log('info', 'Batch updating pages', { count: updates.length });

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const result = await this.updatePage(update.pageId, update.properties);
        results.push({ pageId: update.pageId, success: true, result });
      } catch (error) {
        errors.push({ pageId: update.pageId, error: error.message });
      }
    }

    return {
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  /**
   * Batch create multiple pages
   */
  async batchCreate(items) {
    this.log('info', 'Batch creating pages', { count: items.length });

    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        const result = await this.createPage(
          item.parentId,
          item.properties,
          item.children
        );
        results.push({ success: true, result });
      } catch (error) {
        errors.push({ item, error: error.message });
      }
    }

    return {
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  // ============================================
  // Helper Methods for Common Operations
  // ============================================

  /**
   * Create a simple text page
   */
  async createTextPage(parentId, title, content) {
    return await this.createPage(parentId, {
      title: {
        title: [
          {
            text: { content: title }
          }
        ]
      }
    }, [
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: content }
            }
          ]
        }
      }
    ]);
  }

  /**
   * Add comment to a page
   */
  async addComment(pageId, comment) {
    this.log('info', 'Adding comment', { pageId });

    const response = await this.notionTools['mcp__notion__API-create-a-comment']({
      parent: {
        page_id: pageId
      },
      rich_text: [
        {
          text: {
            content: comment
          }
        }
      ]
    });

    return response;
  }

  /**
   * Get comments on a page
   */
  async getComments(pageId) {
    this.log('info', 'Getting comments', { pageId });

    const response = await this.notionTools['mcp__notion__API-retrieve-a-comment']({
      block_id: pageId
    });

    return response.results;
  }

  /**
   * Build property object for database entries
   */
  buildProperties(data) {
    const properties = {};

    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string') {
        properties[key] = {
          rich_text: [
            {
              type: 'text',
              text: { content: value }
            }
          ]
        };
      } else if (typeof value === 'number') {
        properties[key] = {
          number: value
        };
      } else if (typeof value === 'boolean') {
        properties[key] = {
          checkbox: value
        };
      } else if (Array.isArray(value)) {
        properties[key] = {
          multi_select: value.map(v => ({ name: v }))
        };
      }
    });

    return properties;
  }

  /**
   * Parse Notion properties to simple object
   */
  parseProperties(properties) {
    const parsed = {};

    Object.entries(properties).forEach(([key, prop]) => {
      if (prop.type === 'title') {
        parsed[key] = prop.title[0]?.text?.content || '';
      } else if (prop.type === 'rich_text') {
        parsed[key] = prop.rich_text[0]?.text?.content || '';
      } else if (prop.type === 'number') {
        parsed[key] = prop.number;
      } else if (prop.type === 'select') {
        parsed[key] = prop.select?.name || null;
      } else if (prop.type === 'multi_select') {
        parsed[key] = prop.multi_select.map(s => s.name);
      } else if (prop.type === 'date') {
        parsed[key] = prop.date?.start || null;
      } else if (prop.type === 'checkbox') {
        parsed[key] = prop.checkbox;
      } else if (prop.type === 'status') {
        parsed[key] = prop.status?.name || null;
      }
    });

    return parsed;
  }

  /**
   * Get all users in workspace
   */
  async getUsers() {
    this.log('info', 'Getting workspace users');

    const response = await this.notionTools['mcp__notion__API-get-users']({});

    return response.results;
  }

  /**
   * Get current bot user
   */
  async getSelf() {
    this.log('info', 'Getting bot user info');

    const response = await this.notionTools['mcp__notion__API-get-self']({});

    return response;
  }
}

module.exports = NotionAgent;
