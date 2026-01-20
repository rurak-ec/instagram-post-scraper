import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IgAccount } from '@config/configuration';
import * as fs from 'fs';
import * as path from 'path';

interface AccountStatus {
  isActive: boolean;
  lastSuccess: number | null;       // Unix timestamp del último scrape exitoso
  lastFailure: number | null;       // Unix timestamp del último fallo
  failureReason: string | null;     // Motivo del último fallo
  consecutiveFailures: number;      // Contador de fallos consecutivos
}

interface RotationState {
  lastUsedIndex: number;
  lastUsedTimestamps: Record<string, number>;
  usageCount: Record<string, number>;
  accountStatus: Record<string, AccountStatus>;
}

@Injectable()
export class AccountsService implements OnModuleInit {
  private readonly logger = new Logger(AccountsService.name);
  private accounts: IgAccount[] = [];
  private rotationStatePath: string;
  private sessionsRootDir: string;

  constructor(private configService: ConfigService) {
    this.accounts = this.configService.get<IgAccount[]>('igAccounts', []);
    const dataRoot = this.configService.get<string>('dataRootDir', 'data');
    this.sessionsRootDir = this.configService.get<string>('sessionsRootDir', 'sessions');

    // Ensure data directory exists
    if (!fs.existsSync(dataRoot)) {
      fs.mkdirSync(dataRoot, { recursive: true });
    }

    this.rotationStatePath = path.join(dataRoot, 'account-rotation-state.json');
  }

  onModuleInit() {
    this.logger.log(`✅ Accounts service initialized with ${this.accounts.length} account(s)`);
    if (this.accounts.length > 0) {
      this.logger.log(`📋 Available accounts: ${this.accounts.map(a => a.username).join(', ')}`);
    }
  }

  /**
   * Get all configured accounts (without passwords)
   */
  getAllAccounts(): Array<{ username: string }> {
    return this.accounts.map(acc => ({ username: acc.username }));
  }

  /**
   * Get account count
   */
  getAccountCount(): number {
    return this.accounts.length;
  }

  /**
   * Get next account in rotation (round-robin)
   */
  getNextAccount(): IgAccount | null {
    if (this.accounts.length === 0) {
      this.logger.warn('⚠️  No accounts configured');
      return null;
    }

    const state = this.readRotationState();
    const nextIndex = (state.lastUsedIndex + 1) % this.accounts.length;
    const account = this.accounts[nextIndex];

    if (!account) {
      this.logger.error(`❌ Account not found at index ${nextIndex}`);
      return null;
    }

    // Update state
    state.lastUsedIndex = nextIndex;
    state.lastUsedTimestamps[account.username] = Date.now();
    state.usageCount[account.username] = (state.usageCount[account.username] || 0) + 1;
    this.writeRotationState(state);

    this.logger.log(
      `🔄 Using account ${nextIndex + 1}/${this.accounts.length}: ${account.username}`,
    );

    return account;
  }

  /**
   * Get current account (last used) without advancing rotation
   */
  getCurrentAccount(): IgAccount | null {
    if (this.accounts.length === 0) {
      return null;
    }

    const state = this.readRotationState();
    if (state.lastUsedIndex === -1) {
      return this.accounts[0] || null;
    }

    return this.accounts[state.lastUsedIndex] || null;
  }

  /**
   * Get least used account (for load balancing)
   */
  getLeastUsedAccount(excludedUsernames: string[] = []): IgAccount | null {
    if (this.accounts.length === 0) {
      return null;
    }

    const state = this.readRotationState();
    let leastUsedAccount: IgAccount | null = null;
    let minUsage = Infinity;

    for (const account of this.accounts) {
      if (excludedUsernames.includes(account.username)) continue;

      const usage = state.usageCount[account.username] || 0;
      if (usage < minUsage) {
        minUsage = usage;
        leastUsedAccount = account;
      }
    }

    if (!leastUsedAccount) {
      // Fallback: if all valid accounts were excluded or none found, return null
      return null;
    }

    this.logger.log(`📊 Selected least used account: ${leastUsedAccount.username} (usage: ${state.usageCount[leastUsedAccount.username] || 0})`);

    // Update state
    state.lastUsedTimestamps[leastUsedAccount.username] = Date.now();
    state.usageCount[leastUsedAccount.username] = (state.usageCount[leastUsedAccount.username] || 0) + 1;
    this.writeRotationState(state);

    return leastUsedAccount;
  }

  /**
   * Get session directory for a specific account
   */
  getAccountSessionDir(account: IgAccount): string {
    const sanitizedUsername = account.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sessionDir = path.join(this.sessionsRootDir, 'instagram', sanitizedUsername);

    // Ensure directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    return sessionDir;
  }

  /**
   * Get rotation statistics
   */
  getRotationStats(): {
    totalAccounts: number;
    currentAccount: string | null;
    stats: Array<{ username: string; usageCount: number; lastUsed: string | null }>;
  } {
    const state = this.readRotationState();
    const currentAccount = this.getCurrentAccount();

    const stats = this.accounts.map(account => ({
      username: account.username,
      usageCount: state.usageCount[account.username] || 0,
      lastUsed: state.lastUsedTimestamps[account.username]
        ? new Date(state.lastUsedTimestamps[account.username]).toISOString()
        : null,
    }));

    return {
      totalAccounts: this.accounts.length,
      currentAccount: currentAccount?.username || null,
      stats,
    };
  }

  /**
   * Read rotation state from file
   */
  private readRotationState(): RotationState {
    const defaults: RotationState = {
      lastUsedIndex: -1,
      lastUsedTimestamps: {},
      usageCount: {},
      accountStatus: {},
    };

    try {
      if (fs.existsSync(this.rotationStatePath)) {
        const content = fs.readFileSync(this.rotationStatePath, 'utf-8');
        const parsed = JSON.parse(content);
        // Merge with defaults to handle legacy files missing new fields
        return { ...defaults, ...parsed };
      }
    } catch (error) {
      this.logger.warn('⚠️  Could not read rotation state, using defaults');
    }

    return defaults;
  }

  /**
   * Write rotation state to file
   */
  private writeRotationState(state: RotationState): void {
    try {
      fs.writeFileSync(
        this.rotationStatePath,
        JSON.stringify(state, null, 2),
        'utf-8',
      );
    } catch (error) {
      this.logger.error('❌ Could not save rotation state:', error);
    }
  }

  /**
   * Update account status after scrape attempt
   * @param username Account username
   * @param success Whether the scrape was successful
   * @param error Optional error message if failed
   */
  updateAccountStatus(username: string, success: boolean, error?: string): void {
    const state = this.readRotationState();
    const now = Math.floor(Date.now() / 1000);

    const currentStatus = state.accountStatus[username] || {
      isActive: true,
      lastSuccess: null,
      lastFailure: null,
      failureReason: null,
      consecutiveFailures: 0,
    };

    if (success) {
      currentStatus.isActive = true;
      currentStatus.lastSuccess = now;
      currentStatus.consecutiveFailures = 0;
      currentStatus.failureReason = null;
      this.logger.log(`✅ Account ${username} marked as active`);
    } else {
      currentStatus.lastFailure = now;
      currentStatus.failureReason = error || 'Unknown error';
      currentStatus.consecutiveFailures += 1;

      // Check for critical errors that require immediate disabling
      const isCriticalError = (error || '').toLowerCase().includes('challenge') || 
                              (error || '').toLowerCase().includes('inhabilitada') || 
                              (error || '').toLowerCase().includes('suspended') || 
                              (error || '').toLowerCase().includes('banned');

      // Mark as inactive immediately for critical errors, or after 3 consecutive failures
      if (isCriticalError || currentStatus.consecutiveFailures >= 3) {
        currentStatus.isActive = false;
        const reason = isCriticalError ? 'CRITICAL ERROR' : 'Too many failures';
        this.logger.warn(`⚠️ Account ${username} marked as INACTIVE (${reason}): ${error}`);
      } else {
        this.logger.warn(`⚠️ Account ${username} failed (${currentStatus.consecutiveFailures}/3): ${error}`);
      }
    }

    state.accountStatus[username] = currentStatus;
    this.writeRotationState(state);
  }

  /**
   * Get status of all configured accounts
   */
  getAccountsStatus(): {
    totalAccounts: number;
    activeAccounts: number;
    inactiveAccounts: number;
    accounts: Array<{
      username: string;
      isActive: boolean;
      lastSuccess: string | null;
      lastFailure: string | null;
      failureReason: string | null;
      consecutiveFailures: number;
    }>;
  } {
    const state = this.readRotationState();

    const accounts = this.accounts.map(account => {
      const status = state.accountStatus[account.username] || {
        isActive: true,
        lastSuccess: null,
        lastFailure: null,
        failureReason: null,
        consecutiveFailures: 0,
      };

      return {
        username: account.username,
        isActive: status.isActive,
        lastSuccess: status.lastSuccess
          ? new Date(status.lastSuccess * 1000).toISOString()
          : null,
        lastFailure: status.lastFailure
          ? new Date(status.lastFailure * 1000).toISOString()
          : null,
        failureReason: status.failureReason,
        consecutiveFailures: status.consecutiveFailures,
      };
    });

    const activeCount = accounts.filter(a => a.isActive).length;

    return {
      totalAccounts: this.accounts.length,
      activeAccounts: activeCount,
      inactiveAccounts: this.accounts.length - activeCount,
      accounts,
    };
  }
}
