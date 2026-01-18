import { Injectable, Logger, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page, Response } from 'playwright';
import { AccountsService } from '../accounts/accounts.service';
import { BrowserService } from './browser.service';
import {
  humanDelay,
  exploreProfile,
  delayBetweenProfiles,
  randomMouseMovements,
  randomDelay,
} from './utils/human-behavior';
import {
  InstagramGraphQLResponse,
  InstagramNode,
  CleanedInstagramPost,
} from './interfaces/instagram-graphql.interface';
import { IgAccount } from '@config/configuration';

@Injectable()
export class InstagramScraperService implements OnModuleInit {
  private readonly logger = new Logger(InstagramScraperService.name);
  private readonly maxPostsPerRequest: number;
  private readonly scraperTimeoutMs: number;

  constructor(
    private configService: ConfigService,
    private accountsService: AccountsService,
    private browserService: BrowserService,
  ) {
    this.maxPostsPerRequest = this.configService.get<number>(
      'maxPostsPerRequest',
      50,
    );
    this.scraperTimeoutMs = this.configService.get<number>(
      'scraperTimeoutMs',
      120000,
    );
  }

  /**
   * Initialize module and verify sessions
   */
  async onModuleInit() {
    // Run verification in background to not block app startup completely if preferred,
    // OR await it to ensure readiness.
    // User requested "verifique... y tenerlas listas" -> await seems appropriate,
    // but preventing app from listening might be annoying if it takes too long.
    // However, for "reporte en vivo" before app is "ready", await is better.
    // Run verification in background to not block app startup completely
    this.verifyAllSessions().catch(err => 
      this.logger.error(`❌ Background verification failed: ${err.message}`)
    );
  }

  /**
   * Verify all configured accounts
   */
  private async verifyAllSessions() {
    this.logger.log('🚀 Starting startup session verification...');
    const accounts = this.configService.get<IgAccount[]>('igAccounts', []);

    if (accounts.length === 0) {
      this.logger.warn('⚠️ No accounts to verify.');
      return;
    }

    const report: Array<{ username: string; status: '✅ OK' | '❌ FAILED' | '⚠️ RETRY'; note?: string }> = [];

    for (const [index, account] of accounts.entries()) {
      this.logger.log(`🔍 [${index + 1}/${accounts.length}] Verifying session for: ${account.username}...`);

      let success = false;
      let attempts = 0;
      const maxRetries = 3;
      let lastError = '';

      while (!success && attempts <= maxRetries) {
        if (attempts > 0) {
          this.logger.warn(`⚠️ Retry ${attempts}/${maxRetries} for ${account.username}...`);
          await humanDelay(2000, 4000);
        }

        try {
          success = await this.ensureSessionReady(account, true);
          if (!success) lastError = 'Verification returned false';
        } catch (error) {
          lastError = error.message;
        }

        if (!success) attempts++;
      }

      report.push({
        username: account.username,
        status: success ? '✅ OK' : '❌ FAILED',
        note: success
          ? (attempts > 0 ? `Active (after ${attempts} retries)` : 'Session active')
          : `Failed (${lastError})`
      });
    }

    // Print final report
    this.logger.log('📊 ====== LIVE SESSION REPORT ======');
    report.forEach(entry => {
      this.logger.log(`${entry.status} ${entry.username} ${entry.note ? `(${entry.note})` : ''}`);
    });
    this.logger.log('====================================');
  }

  /**
   * Ensure a specific account session is ready (logs in if needed)
   */
  private async ensureSessionReady(account: IgAccount, closeOnFinish = true): Promise<boolean> {
    const sessionDir = this.accountsService.getAccountSessionDir(account);
    const loginUrl = 'https://www.instagram.com/accounts/login/';
    let page: Page | null = null;
    let browserContext: any = null;

    try {
      // Launch browser and navigate to login page
      const { page: createdPage, context } = await this.browserService.createPage(
        account,
        sessionDir,
        loginUrl, // Start at login page to detect redirects
      );
      page = createdPage;
      browserContext = context;

      // Wait for load and check for redirect
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
      await humanDelay(1500, 2500);

      // Check if we were redirected (session is active)
      const currentUrl = page.url();
      const needsLogin = currentUrl.includes('/accounts/login');

      if (needsLogin) {
        this.logger.warn(`🔐 Account ${account.username} needs login. Attempting...`);
        await this.performLogin(page, account);

        // Verify by checking login page again
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
        await humanDelay(1500, 2500);

        const verifyUrl = page.url();
        if (verifyUrl.includes('/accounts/login')) {
          this.logger.error(`❌ Verification failed for ${account.username}: Login loop or failure.`);
          return false;
        }

        this.logger.log(`✅ Account ${account.username} logged in successfully.`);
      } else {
        this.logger.log(`✅ Account ${account.username} is already logged in (redirected to: ${currentUrl}).`);
      }

      return true;

    } catch (error) {
      this.logger.error(`❌ Error verifying ${account.username}: ${error.message}`);
      return false;
    } finally {
      if (page && closeOnFinish) {
        await this.browserService.closePage(page);
      }
    }
  }

  /**
   * Scrape multiple Instagram profiles in batch (up to 5)
   * Same bot processes all profiles sequentially before switching
   */
  async scrapeProfiles(
    usernames: string[],
    maxPosts?: number,
    createdAt?: number,
    createdAtMap?: Record<string, number>,
  ): Promise<{
    success: boolean;
    results: Array<{
      success: boolean;
      username: string;
      posts: CleanedInstagramPost[];
      scrapedWith: string;
      scrapedAt: number;
      error?: string;
    }>;
  }> {
    if (!usernames || usernames.length === 0) {
      throw new HttpException('No usernames provided', HttpStatus.BAD_REQUEST);
    }

    if (usernames.length > 5) {
      throw new HttpException('Maximum 5 profiles per batch', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`📦 Starting batch scrape for ${usernames.length} profiles: ${usernames.join(', ')}`);
    const batchStartTime = Date.now();

    const results = [];
    const failedBotUsernames: string[] = [];
    let currentBotAttempt = 0;
    const totalAccounts = this.accountsService.getAccountCount();

    // Try to process all profiles with one bot at a time
    while (currentBotAttempt < totalAccounts && results.length < usernames.length) {
      // Select bot (excluding failed ones)
      const account = this.accountsService.getLeastUsedAccount(failedBotUsernames);

      if (!account) {
        this.logger.error('❌ No more bots available');
        break;
      }

      this.logger.log(`🤖 Attempt ${currentBotAttempt + 1}/${totalAccounts} using bot: ${account.username}`);

      try {
        // Process all remaining profiles with this bot
        const botResults = await this.processBatchWithBot(
          account,
          usernames.slice(results.length), // Only process remaining profiles
          maxPosts,
          createdAt,
          createdAtMap,
        );

        results.push(...botResults);

        // If we successfully processed all profiles, break
        if (results.length >= usernames.length) {
          break;
        }

      } catch (error) {
        this.logger.warn(`⚠️ Bot ${account.username} failed during batch: ${error.message}`);

        // Mark bot as failed and trigger repair
        failedBotUsernames.push(account.username);
        this.repairSession(account).catch(err =>
          this.logger.error(`❌ Background repair error for ${account.username}: ${err.message}`)
        );
      }

      currentBotAttempt++;
    }

    // Check if we got all results
    const batchDuration = Date.now() - batchStartTime;
    const allSuccess = results.length === usernames.length && results.every(r => r.success);

    this.logger.log(
      `📊 Batch complete: ${results.length}/${usernames.length} profiles processed in ${batchDuration}ms`
    );

    return {
      success: allSuccess,
      results,
    };
  }

  /**
   * Process batch of profiles with a specific bot account (PARALLEL execution)
   * Opens multiple tabs in the same browser context for simultaneous scraping
   */
  private async processBatchWithBot(
    account: IgAccount,
    usernames: string[],
    maxPosts?: number,
    createdAt?: number,
    createdAtMap?: Record<string, number>,
  ): Promise<Array<{
    success: boolean;
    username: string;
    posts: CleanedInstagramPost[];
    scrapedWith: string;
    scrapedAt: number;
    error?: string;
  }>> {
    // LIMIT CONCURRENCY: Process in batches of 2 to prevent resource exhaustion
    const CONCURRENCY_LIMIT = 2;
    this.logger.log(`🔄 Bot ${account.username} processing ${usernames.length} profiles (max ${CONCURRENCY_LIMIT} concurrent)...`);

    const sessionDir = this.accountsService.getAccountSessionDir(account);

    // Get or create the shared browser context for this account
    const { context } = await this.browserService.getBrowserForSession(sessionDir);

    const results: Array<{
      success: boolean;
      username: string;
      posts: CleanedInstagramPost[];
      scrapedWith: string;
      scrapedAt: number;
      error?: string;
    }> = [];

    // Process in controlled batches
    for (let i = 0; i < usernames.length; i += CONCURRENCY_LIMIT) {
      const batch = usernames.slice(i, i + CONCURRENCY_LIMIT);
      this.logger.log(`📦 Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(usernames.length / CONCURRENCY_LIMIT)}: ${batch.join(', ')}`);

      const scrapePromises = batch.map(async (username, index) => {
        const absoluteIndex = i + index;
        this.logger.log(`📍 [${absoluteIndex + 1}/${usernames.length}] Starting scrape for @${username} with bot ${account.username}`);
        const profileStartTime = Date.now();

        try {
          // Use per-profile createdAt from map, or fall back to global createdAt
          const profileCreatedAt = createdAtMap?.[username] ?? createdAt;
          const result = await this.executeScrapeWithContext(context, account, username, profileStartTime, maxPosts, profileCreatedAt);
          return result;

        } catch (error) {
          this.logger.error(`❌ Failed to scrape @${username}: ${error.message}`);
          return {
            success: false,
            username,
            posts: [] as CleanedInstagramPost[],
            scrapedWith: account.username,
            scrapedAt: Math.floor(Date.now() / 1000),
            error: error.message,
          };
        }
      });

      // Wait for current batch to complete before moving to next batch
      const batchResults = await Promise.all(scrapePromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + CONCURRENCY_LIMIT < usernames.length) {
        await humanDelay(1000, 2000);
      }
    }

    // Update account status based on results
    const allFailed = results.every(r => !r.success);
    const anyFailed = results.some(r => !r.success);

    if (allFailed) {
      this.accountsService.updateAccountStatus(account.username, false, 'All parallel scrapes failed');
    } else if (!anyFailed) {
      this.accountsService.updateAccountStatus(account.username, true);
    }

    this.logger.log(`✅ Batch complete: ${results.filter(r => r.success).length}/${usernames.length} successful`);

    // CRITICAL: Close browser context after batch to free resources
    try {
      await this.browserService.closeBrowserForSession(sessionDir);
      this.logger.log(`🔒 Closed browser context for ${account.username} to free resources`);
    } catch (err) {
      this.logger.warn(`Failed to close browser context: ${err.message}`);
    }

    return results;
  }

  /**
   * Execute scrape using a shared browser context (for parallel batch processing)
   */
  private async executeScrapeWithContext(
    context: any,
    account: IgAccount,
    targetUsername: string,
    startTime: number,
    maxPosts?: number,
    createdAt?: number,
  ) {
    const profileUrl = `https://www.instagram.com/${targetUsername}/`;

    // Create a new page (tab) in the shared context
    const page: Page = await context.newPage();
    if (!page) {
      throw new Error(`Failed to create page for @${targetUsername}`);
    }

    // Track CDP session for cleanup
    let cdpSession: any = null;

    try {

      // Set realistic user agent and headers
      const { getRandomUserAgent, getRealisticHeaders } = require('./utils/browser-config');
      const userAgent = getRandomUserAgent();
      const headers = {
        ...getRealisticHeaders(),
        'User-Agent': userAgent,
      };
      await page.setExtraHTTPHeaders(headers);

      // Setup CDP session with emulated focus for this new page
      try {
        cdpSession = await context.newCDPSession(page);
        await cdpSession.send('Emulation.setFocusEmulationEnabled', {
          enabled: true,
        });
      } catch {
        // Not critical, continue without CDP
      }

      // Navigate to profile
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });

      // Wait for page load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
      await humanDelay(1000, 2000);

      // Check if login is required (session invalid)
      const needsLogin = await this.checkIfLoginRequired(page);
      if (needsLogin) {
        throw new Error('Session invalid (login required). Triggering repair.');
      }

      // Verify we are actually on the profile (not error page or login wall)
      const title = await page.title();
      if (title.includes('Login') || title.includes('Page Not Found')) {
        throw new Error(`Failed to load profile (Title: ${title})`);
      }

      // Check for private account
      const isPrivate = await this.checkIfPrivate(page);
      if (isPrivate) {
        this.logger.warn(`🔒 Account @${targetUsername} is private.`);
        return {
          success: false,
          username: targetUsername,
          posts: [] as CleanedInstagramPost[],
          scrapedWith: account.username,
          scrapedAt: Math.floor(Date.now() / 1000),
          error: 'Account is private',
        };
      }

      // Simulate human behavior (lighter version for speed)
      await randomMouseMovements(page, 2);
      await humanDelay(500, 1500);

      // Scrape posts
      const { posts, graphqlCaptured } = await this.scrapePostsFromPage(page, targetUsername, maxPosts);

      // Log posts with filter information
      this.logger.log(`📊 [${targetUsername}] Raw posts count: ${posts.length}`);

      // Filter by date if provided
      let filteredPosts = posts;
      if (createdAt) {
        filteredPosts = posts.filter((post) => post.createdAt > createdAt);
        this.logger.log(`📊 [${targetUsername}] After filter: ${filteredPosts.length} posts passed (createdAt > ${createdAt})`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Scraped ${filteredPosts.length} posts from @${targetUsername} in ${duration}ms`,
      );

      return {
        success: true,
        username: targetUsername,
        posts: filteredPosts,
        postsCount: filteredPosts.length,
        graphqlCaptured,
        scrapedWith: account.username,
        scrapedAt: Math.floor(Date.now() / 1000),
      };

    } catch (error) {
      // Propagate error to trigger fallback
      throw error;
    } finally {
      // Cleanup CDP session first
      if (cdpSession) {
        try {
          await cdpSession.detach();
        } catch (err) {
          this.logger.warn(`Failed to detach CDP session: ${err.message}`);
        }
      }

      // Ensure page is closed
      await this.browserService.closePage(page);
    }
  }

  /**
   * Scrape Instagram profile (single)
   */
  async scrapeProfile(
    username: string,
    maxPosts?: number,
    createdAt?: number,
  ): Promise<{
    success: boolean;
    username: string;
    posts: CleanedInstagramPost[];
    scrapedWith: string;
    scrapedAt: number;
  }> {
    const startTime = Date.now();
    this.logger.log(`🔍 Starting scrape for: @${username}`);

    const failedUsernames: string[] = [];
    let attempts = 0;
    const totalAccounts = this.accountsService.getAccountCount();

    // Loop until we succeed or run out of accounts
    while (attempts < totalAccounts) {
      // 1. Select account (excluding those that failed)
      const account = this.accountsService.getLeastUsedAccount(failedUsernames);

      if (!account) {
        break; // No more accounts available
      }

      this.logger.log(`🔄 Attempt ${attempts + 1}/${totalAccounts} using account: ${account.username}`);

      try {
        // 2. Try to scrape
        return await this.executeScrape(account, username, startTime, maxPosts, createdAt);
      } catch (error) {
        this.logger.warn(`⚠️ Attempt failed with ${account.username}: ${error.message}`);

        // 3. Mark as failed and trigger background repair
        failedUsernames.push(account.username);
        this.accountsService.updateAccountStatus(account.username, false, error.message);
        this.repairSession(account).catch(err =>
          this.logger.error(`❌ Background repair error for ${account.username}: ${err.message}`)
        );

        attempts++;
      }
    }

    // If we get here, all available accounts failed
    const duration = Date.now() - startTime;
    this.logger.error(`❌ All accounts failed to scrape @${username} after ${duration}ms`);
    throw new HttpException(
      `Scraping failed after trying ${attempts} accounts. Last error logged.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Internal method to execute the scraping logic with a specific account
   */
  private async executeScrape(
    account: IgAccount,
    targetUsername: string,
    startTime: number,
    maxPosts?: number,
    createdAt?: number,
  ) {
    const sessionDir = this.accountsService.getAccountSessionDir(account);
    let page: Page | null = null;
    let browserContext: any = null;

    try {
      this.logger.log(`📂 Using session: ${sessionDir}`);

      const profileUrl = `https://www.instagram.com/${targetUsername}/`;

      // Create browser page
      const { page: createdPage, context } = await this.browserService.createPage(
        account,
        sessionDir,
        profileUrl,
      );
      page = createdPage;
      browserContext = context;

      // Wait for page load
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
      await humanDelay(1000, 2000);

      // Check if login is required (session invalid)
      const needsLogin = await this.checkIfLoginRequired(page);
      if (needsLogin) {
        throw new Error('Session invalid (login required). Triggering repair.');
      }

      // Navigate to profile if not already there
      if (!page.url().includes(`/${targetUsername}/`)) {
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
        await humanDelay(1000, 2000);
      }

      // Verify we are actually on the profile (not error page or login wall)
      const title = await page.title();
      if (title.includes('Login') || title.includes('Page Not Found')) {
        throw new Error(`Failed to load profile (Title: ${title})`);
      }

      // Check for private account
      const isPrivate = await this.checkIfPrivate(page);
      if (isPrivate) {
        this.logger.warn(`🔒 Account @${targetUsername} is private.`);
        return {
          success: false,
          username: targetUsername,
          posts: [],
          scrapedWith: account.username,
          scrapedAt: Math.floor(Date.now() / 1000),
          error: 'Account is private',
        };
      }

      // Simulate human behavior (lighter version for speed)
      await randomMouseMovements(page, 2);
      await humanDelay(500, 1500);

      // Scrape posts
      const { posts, graphqlCaptured } = await this.scrapePostsFromPage(page, targetUsername, maxPosts);

      // Log posts with filter information
      this.logger.log(`📊 Raw posts count: ${posts.length}`);
      if (posts.length > 0 && createdAt) {
        this.logger.log(`📊 Filter: createdAt > ${createdAt}`);
        posts.forEach((p, i) => {
          const passes = p.createdAt > createdAt;
          this.logger.log(`📊 [${i + 1}] ${p.shortcode}: ${p.createdAt} ${passes ? '✅ PASSES' : '❌ FILTERED'} (diff: ${p.createdAt - createdAt})`);
        });
      } else if (posts.length > 0) {
        this.logger.log(`📊 No createdAt filter. All posts:`);
        posts.forEach((p, i) => {
          this.logger.log(`📊 [${i + 1}] ${p.shortcode}: ${p.createdAt}`);
        });
      }

      // Filter by date if provided
      let filteredPosts = posts;
      if (createdAt) {
        filteredPosts = posts.filter((post) => post.createdAt > createdAt);
        this.logger.log(`📊 After filter: ${filteredPosts.length} posts passed (createdAt > ${createdAt})`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Scraped ${filteredPosts.length} posts from @${targetUsername} in ${duration}ms`,
      );

      // Update account status as successful
      this.accountsService.updateAccountStatus(account.username, true);

      return {
        success: true,
        username: targetUsername,
        posts: filteredPosts,
        postsCount: filteredPosts.length,
        graphqlCaptured,
        scrapedWith: account.username,
        scrapedAt: Math.floor(Date.now() / 1000),
      };

    } catch (error) {
      // Propagate error to trigger fallback
      throw error;
    } finally {
      // Ensure page is closed
      if (page) {
        await this.browserService.closePage(page);
      }
    }
  }

  /**
   * Check if the account is private
   */
  private async checkIfPrivate(page: Page): Promise<boolean> {
    try {
      const privateText = await page.getByText(/Esta cuenta es privada|This Account is Private/i).count();
      return privateText > 0;
    } catch {
      return false;
    }
  }

  /**
   * Attempt to repair a broken session in the background
   */
  private async repairSession(account: IgAccount) {
    this.logger.log(`🔧 Starting background repair for: ${account.username}`);
    try {
      // Force close any existing browser instances for this session to clear locks
      const sessionDir = this.accountsService.getAccountSessionDir(account);
      await this.browserService.closeBrowserForSession(sessionDir);

      // Re-verify which attempts login
      const result = await this.ensureSessionReady(account, true);
      if (result) {
        this.logger.log(`✅ Repair successful for ${account.username}. Ready for rotation.`);
      } else {
        this.logger.warn(`⚠️ Repair failed for ${account.username}. Check credentials.`);
      }
    } catch (error) {
      this.logger.error(`❌ Repair crashed for ${account.username}: ${error.message}`);
    }
  }

  /**
   * Check if login is required
   */
  private async checkIfLoginRequired(page: Page): Promise<boolean> {
    // Check for login form
    const loginForm = await page.locator('input[name="username"]').count();
    return loginForm > 0;
  }

  /**
   * Perform Instagram login
   */
  private async performLogin(page: Page, account: IgAccount): Promise<void> {
    this.logger.log(`🔐 Performing login for: ${account.username}`);

    try {
      // Wait for login form (accepting both standard and alternative fields)
      await page.waitForSelector('input[name="username"], input[name="email"]', { timeout: 10000 });

      // Check for username field (standard or alternative)
      const usernameSelector = await page.isVisible('input[name="username"]') 
        ? 'input[name="username"]' 
        : 'input[name="email"]'; // Fallback for some login forms

      await page.fill(usernameSelector, account.username);
      await humanDelay(600, 1500);

      // Check for password field (standard or alternative)
      const passwordSelector = await page.isVisible('input[name="password"]')
        ? 'input[name="password"]'
        : 'input[name="pass"]'; // Fallback for some login forms

      await page.fill(passwordSelector, account.password);
      await humanDelay(1000, 2500);

      // Click login button (handle standard button or div-based button)
      const loginButtonSelector = 'button[type="submit"]';
      if (await page.isVisible(loginButtonSelector)) {
        await page.click(loginButtonSelector);
      } else {
        // Fallback for div-based buttons (Facebook style / new Instagram login)
        // Look for text "Log in" or "Iniciar sesión"
        const loginTextSelector = 'div[role="button"]:has-text("Iniciar sesión"), div[role="button"]:has-text("Log in")';
        await page.waitForSelector(loginTextSelector, { timeout: 5000 });
        await page.click(loginTextSelector);
      }

      // Wait for navigation
      await page.waitForFunction(
        () => !window.location.href.includes('/accounts/login'),
        { timeout: 35000 },
      );

      await humanDelay(2500, 4500);

      this.logger.log(`✅ Login successful for: ${account.username}`);
    } catch (error) {
      this.logger.error(`❌ Login failed: ${error.message}`);
      throw new Error(`Login failed for ${account.username}`);
    }
  }

  /**
   * Scrape posts from Instagram page
   */
  private async scrapePostsFromPage(
    page: Page,
    username: string,
    maxPosts?: number,
  ): Promise<{ posts: CleanedInstagramPost[]; graphqlCaptured: boolean }> {
    const limit = maxPosts || this.maxPostsPerRequest;
    const posts: CleanedInstagramPost[] = [];
    const uniqueIds = new Set<string>();

    // Listen for GraphQL responses BEFORE any navigation
    const graphqlResponses: InstagramGraphQLResponse[] = [];

    // Create named handler function so we can remove it later
    const responseHandler = async (response: Response) => {
      const url = response.url();
      // Capture all Instagram GraphQL responses
      if (url.includes('graphql/query')) {
        try {
          const data = await response.json();
          const dataKeys = data.data ? Object.keys(data.data) : [];
          this.logger.debug(`📊 Intercepted: ${url.substring(0, 80)} | keys: ${dataKeys.join(', ') || Object.keys(data).join(', ')}`);

          // Only capture responses with timeline data
          if (data.data?.xdt_api__v1__feed__user_timeline_graphql_connection?.edges) {
            graphqlResponses.push(data);
            this.logger.log(`📊 Captured timeline response with ${data.data.xdt_api__v1__feed__user_timeline_graphql_connection.edges.length} posts`);
          }
        } catch {
          // Ignore parsing errors
        }
      }
    };

    page.on('response', responseHandler);

    // Reload the page to capture the initial GraphQL response with the listener active
    this.logger.log(`🔄 Reloading profile page to capture GraphQL response...`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await humanDelay(3000, 4000); // Wait for GraphQL response

    // Progressive scroll to load more posts until limit is reached
    // No max limit - keeps scrolling until target reached or feed ends
    let scrollAttempts = 0;
    let lastPostCount = 0;
    let noNewPostsCount = 0;
    const STALE_SCROLL_THRESHOLD = 5; // Stop after 5 consecutive scrolls with no new posts

    this.logger.log(`📊 Target: ${limit} posts. Starting progressive scroll...`);

    while (true) {
      // Count current unique posts from all captured GraphQL responses
      const currentPostCount = graphqlResponses.reduce((sum, r) => 
        sum + (r.data?.xdt_api__v1__feed__user_timeline_graphql_connection?.edges?.length || 0), 0);
      
      // Stop if we have enough posts
      if (currentPostCount >= limit) {
        this.logger.log(`✅ Reached post limit: ${currentPostCount}/${limit}`);
        break;
      }
      
      // Check if we're getting new posts
      if (currentPostCount === lastPostCount) {
        noNewPostsCount++;
        // Stop if no new posts after 5 consecutive scrolls (end of feed)
        if (noNewPostsCount >= STALE_SCROLL_THRESHOLD) {
          this.logger.log(`📭 No more posts available (${currentPostCount} total after ${scrollAttempts} scrolls, ${STALE_SCROLL_THRESHOLD} stale)`);
          break;
        }
      } else {
        noNewPostsCount = 0;
        this.logger.log(`📊 Scroll ${scrollAttempts + 1}: ${currentPostCount} posts loaded...`);
      }
      
      lastPostCount = currentPostCount;
      
      // Scroll down to trigger loading more posts
      await page.mouse.wheel(0, randomDelay(800, 1200));
      await humanDelay(1500, 2500);
      
      scrollAttempts++;
    }

    // Final wait for any pending responses
    await humanDelay(2000, 3000);

    // Process GraphQL responses - only use xdt_api__v1__feed__user_timeline_graphql_connection
    // DEBUG: Save all responses to file for analysis
    const fs = require('fs');
    fs.writeFileSync('/tmp/graphql_debug.json', JSON.stringify(graphqlResponses, null, 2));
    this.logger.log(`📊 Saved ${graphqlResponses.length} GraphQL responses to /tmp/graphql_debug.json`);
    
    for (const response of graphqlResponses) {
      const edges =
        response.data?.xdt_api__v1__feed__user_timeline_graphql_connection
          ?.edges;
      if (edges) {
        this.logger.log(`📊 Found ${edges.length} edges in timeline. Shortcodes: ${edges.map((e: any) => e.node?.code).join(', ')}`);
        for (const edge of edges) {
          const node = edge.node;
          // Skip duplicates
          if (!node.id || uniqueIds.has(node.id)) continue;

          const cleanPost = this.cleanNode(node, username);
          if (cleanPost) {
            posts.push(cleanPost);
            uniqueIds.add(node.id);
          }
        }
      }
    }

    // Sort by createdAt DESCENDING (newest first) - this ensures we get the most recent posts
    posts.sort((a, b) => b.createdAt - a.createdAt);

    // Track if we captured any GraphQL responses
    const graphqlCaptured = graphqlResponses.length > 0;

    // Log warning if no GraphQL was captured (potential account restriction)
    if (!graphqlCaptured) {
      this.logger.warn(`⚠️ [${username}] No GraphQL responses captured. This may indicate:`);
      this.logger.warn(`   • The Instagram account used for scraping may have restrictions`);
      this.logger.warn(`   • The profile may have changed privacy settings`);
      this.logger.warn(`   • Instagram may be blocking automated access`);
      this.logger.warn(`   👉 Check /accounts/status to verify account health`);
    } else if (posts.length === 0) {
      this.logger.log(`📭 [${username}] GraphQL captured but 0 posts found - profile may have no posts or all posts filtered`);
    }

    // CRITICAL: Remove event listener to prevent memory leak
    page.off('response', responseHandler);

    // Apply limit AFTER sorting (so we get the newest posts, not oldest pinned posts)
    return { posts: posts.slice(0, limit), graphqlCaptured };
  }

  /**
   * Clean raw Instagram node to standardized format (using real GraphQL structure)
   */
  private cleanNode(node: InstagramNode, username: string): CleanedInstagramPost | null {
    try {
      // Validate required fields
      if (!node.id || !node.code) {
        this.logger.warn('Missing required fields (id or code)');
        return null;
      }

      // Extract caption text
      const text = node.caption?.text || '';

      // Extract timestamp - try taken_at first, fallback to caption.created_at
      const createdAt = node.taken_at || node.caption?.created_at || 0;

      // Determine type based on product_type and media_type
      let type: 'feed' | 'clips' | 'carousel';
      if (node.product_type === 'clips' || node.media_type === 2) {
        type = 'clips';
      } else if (node.media_type === 8) {
        type = 'carousel';
      } else {
        type = 'feed';
      }

      // Extract media based on post type
      const media: CleanedInstagramPost['media'] = [];

      if (type === 'carousel' && node.carousel_media) {
        // Multi-image/video post (carousel)
        for (const carouselItem of node.carousel_media) {
          if (carouselItem.media_type === 2 && carouselItem.video_versions) {
            // Video in carousel - get highest quality
            const bestVideo = carouselItem.video_versions.reduce((best, current) =>
              (current.width * current.height > best.width * best.height) ? current : best
            );
            media.push({
              url: bestVideo.url,
              type: 'video',
              width: bestVideo.width,
              height: bestVideo.height,
            });
          } else if (carouselItem.image_versions2?.candidates) {
            // Image in carousel - get highest quality (first candidate)
            const bestImage = carouselItem.image_versions2.candidates[0];
            if (bestImage) {
              media.push({
                url: bestImage.url,
                type: 'image',
                width: bestImage.width,
                height: bestImage.height,
              });
            }
          }
        }
      } else if (type === 'clips' && node.video_versions) {
        // Single video post (Reel/IGTV)
        const bestVideo = node.video_versions.reduce((best, current) =>
          (current.width * current.height > best.width * best.height) ? current : best
        );
        media.push({
          url: bestVideo.url,
          type: 'video',
          width: bestVideo.width,
          height: bestVideo.height,
        });
      } else if (node.image_versions2?.candidates) {
        // Single image post
        const bestImage = node.image_versions2.candidates[0];
        if (bestImage) {
          media.push({
            url: bestImage.url,
            type: 'image',
            width: bestImage.width,
            height: bestImage.height,
          });
        }
      }

      // Extract engagement metrics
      const likes = node.like_count || 0;
      const comments = node.comment_count || 0;

      // Build permalink using code (shortcode)
      const permalink = `https://instagram.com/p/${node.code}/`;

      return {
        id: node.id,
        shortcode: node.code,
        text,
        createdAt,
        type,
        username,
        media,
        likes,
        comments,
        permalink,
        originalData: {
          productType: node.product_type,
          mediaType: node.media_type,
          hasAudio: node.has_audio || false,
        },
      };
    } catch (error) {
      this.logger.warn(`Failed to clean node: ${error.message}`);
      return null;
    }
  }


}
