import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, BrowserContext, Page, CDPSession } from 'playwright';
import { IgAccount } from '@config/configuration';
import {
  getBrowserLaunchOptions,
  getRandomUserAgent,
  getRealisticHeaders,
} from './utils/browser-config';
import * as fs from 'fs';
import * as path from 'path';

interface BrowserInstance {
  browser: Browser;
  context: BrowserContext;
  sessionDir: string;
}

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browserInstances: Map<string, BrowserInstance> = new Map();
  private launchingInstances: Map<string, Promise<BrowserInstance>> = new Map();
  private headless: boolean;

  constructor(private configService: ConfigService) {
    this.headless = this.configService.get<boolean>('headless', true);
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    this.logger.log('🔄 Closing all browser instances...');
    const closePromises = Array.from(this.browserInstances.values()).map(
      async (instance) => {
        try {
          await instance.context.close();
        } catch (error) {
          this.logger.error(`Error closing browser instance: ${error.message}`);
        }
      },
    );
    await Promise.all(closePromises);
    this.browserInstances.clear();
    this.logger.log('✅ All browser instances closed');
  }

  /**
   * Get or create browser instance for a specific session directory
   */
  async getBrowserForSession(sessionDir: string): Promise<BrowserInstance> {
    // Check if instance exists and is connected
    const existing = this.browserInstances.get(sessionDir);
    if (existing) {
      try {
        const isConnected = existing.browser.isConnected();
        if (isConnected) {
          this.logger.debug(`♻️  Reusing existing browser for: ${sessionDir}`);
          return existing;
        }
      } catch {
        // Instance is disconnected
        this.browserInstances.delete(sessionDir);
      }
    }

    // Check if launch is in progress
    const launching = this.launchingInstances.get(sessionDir);
    if (launching) {
      this.logger.debug(`⏳ Waiting for browser launch: ${sessionDir}`);
      try {
        return await launching;
      } finally {
        this.launchingInstances.delete(sessionDir);
      }
    }

    // Launch new browser instance
    this.ensureSessionDir(sessionDir);
    this.cleanStaleLocks(sessionDir);

    const launchPromise = this.launchBrowser(sessionDir);
    this.launchingInstances.set(sessionDir, launchPromise);

    try {
      const instance = await launchPromise;
      this.browserInstances.set(sessionDir, instance);
      return instance;
    } finally {
      this.launchingInstances.delete(sessionDir);
    }
  }

  /**
   * Create a configured page for a specific account
   */
  async createPage(
    account: IgAccount,
    sessionDir: string,
    targetUrl: string,
  ): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page;
    cdpSession: CDPSession | null;
  }> {
    const { browser, context } = await this.getBrowserForSession(sessionDir);

    // Reuse existing page or create new one
    const pages = context.pages();
    let page: Page;

    if (pages.length > 0 && pages[0]) {
      page = pages[0];
    } else {
      page = await context.newPage();
    }

    // Set realistic user agent and headers
    const userAgent = getRandomUserAgent();
    const headers = {
      ...getRealisticHeaders(),
      'User-Agent': userAgent,
    };
    await page.setExtraHTTPHeaders(headers);

    // Inject anti-detection scripts
    await this.injectAntiDetectionScripts(page);

    // Setup CDP session
    let cdpSession: CDPSession | null = null;
    try {
      cdpSession = await context.newCDPSession(page);
      await cdpSession.send('Emulation.setFocusEmulationEnabled', {
        enabled: true,
      });
    } catch {
      // Not critical, continue without CDP
    }

    // Navigate to target URL
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    return { browser, context, page, cdpSession };
  }

  /**
   * Close a specific page (not the entire browser)
   */
  async closePage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close({ runBeforeUnload: true });
      }
    } catch (error) {
      this.logger.warn(`Error closing page: ${error.message}`);
    }
  }

  /**
   * Close entire browser instance for a session
   */
  async closeBrowserForSession(sessionDir: string): Promise<void> {
    const instance = this.browserInstances.get(sessionDir);
    if (instance) {
      try {
        await instance.context.close();
      } catch (error) {
        this.logger.error(`Error closing browser: ${error.message}`);
      }
      this.browserInstances.delete(sessionDir);
    }
  }

  /**
   * Launch browser with persistent context
   */
  private async launchBrowser(sessionDir: string): Promise<BrowserInstance> {
    this.logger.log(`🚀 Launching browser for session: ${sessionDir}`);

    const launchOptions = getBrowserLaunchOptions(this.headless);

    // Log chrome executable path for debugging
    this.logger.debug(`Chrome executable path: ${launchOptions.executablePath}`);
    this.logger.debug(`Headless mode: ${this.headless}`);
    this.logger.debug(`Session directory: ${sessionDir}`);

    // Add arguments to suppress profile errors and improve stability
    if (!launchOptions.args) launchOptions.args = [];
    launchOptions.args.push(
      '--no-default-browser-check',
      '--no-first-run',
      '--disable-session-crashed-bubble',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
    );
    // Ignore default args that might cause issues
    (launchOptions as any).ignoreDefaultArgs = ['--enable-automation'];

    // Aggressively clean locks before launch
    this.cleanStaleLocks(sessionDir);

    let browser;
    try {
      browser = await chromium.launchPersistentContext(
        sessionDir,
        launchOptions,
      );
      this.logger.log(`✅ Browser launched successfully for: ${sessionDir}`);
    } catch (error) {
      this.logger.error(`❌ Failed to launch browser: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }

    // Handle browser close event
    browser.on('close', () => {
      this.logger.log(`Browser closed for session: ${sessionDir}`);
      this.browserInstances.delete(sessionDir);
    });

    const instance: BrowserInstance = {
      browser: browser as any as Browser,
      context: browser,
      sessionDir,
    };

    return instance;
  }

  /**
   * Inject scripts to hide automation
   */
  private async injectAntiDetectionScripts(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Remove navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({
            state: Notification.permission,
          } as PermissionStatus)
          : originalQuery(parameters);

      // Add chrome runtime
      (window as any).chrome = {
        runtime: {},
      };

      // Realistic plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {
              type: 'application/x-google-chrome-pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
            },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin',
          },
          {
            0: {
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
            },
            description: 'Portable Document Format',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            length: 1,
            name: 'Chrome PDF Viewer',
          },
        ],
      });
    });
  }

  /**
   * Ensure session directory exists
   */
  private ensureSessionDir(sessionDir: string): void {
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
  }

  /**
   * Clean stale Chrome locks
   */
  private cleanStaleLocks(sessionDir: string): void {
    try {
      const lockPath = path.join(sessionDir, 'SingletonLock');
      const socketPath = path.join(sessionDir, 'SingletonSocket');
      const cookiePath = path.join(sessionDir, 'SingletonCookie');

      try {
        fs.unlinkSync(lockPath);
      } catch { }
      try {
        fs.unlinkSync(socketPath);
      } catch { }
      try {
        fs.unlinkSync(cookiePath);
      } catch { }
    } catch {
      // Ignore errors
    }
  }
}
