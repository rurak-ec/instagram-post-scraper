export interface IgAccount {
  username: string;
  password: string;
}

/**
 * Parsea cuentas de Instagram desde variables de entorno.
 * Formato: IG_ACCOUNT_1=username:password
 */
function parseIgAccounts(): IgAccount[] {
  const accounts: IgAccount[] = [];
  let index = 1;

  while (true) {
    const accountVar = process.env[`IG_ACCOUNT_${index}`];
    if (!accountVar) break;

    const parts = accountVar.split(':');
    if (parts.length !== 2 || !parts[0]?.trim() || !parts[1]?.trim()) {
      console.warn(
        `[CONFIG] IG_ACCOUNT_${index} mal formateado (debe ser username:password). Saltando...`,
      );
      index++;
      continue;
    }

    accounts.push({
      username: parts[0].trim(),
      password: parts[1].trim(),
    });
    index++;
  }

  if (accounts.length === 0) {
    console.warn(
      '[CONFIG] ⚠️  No se encontraron cuentas de Instagram configuradas. Define IG_ACCOUNT_1, IG_ACCOUNT_2, etc.',
    );
  } else {
    console.log(`[CONFIG] ✅ ${accounts.length} cuenta(s) de Instagram configuradas`);
  }

  return accounts;
}

export default () => ({
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Instagram accounts
  igAccounts: parseIgAccounts(),

  // Browser
  headless: process.env.DOCKER_ENV === 'true' ? true : process.env.HEADLESS === 'true',
  verboseLogs: process.env.VERBOSE_LOGS === 'true',
  chromePath: process.env.CHROME_PATH || undefined,

  // Scraper
  maxPostsPerRequest: parseInt(process.env.MAX_POSTS_PER_REQUEST || '50', 10),
  scraperTimeoutMs: parseInt(process.env.SCRAPER_TIMEOUT_MS || '120000', 10),
  scraperConcurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '3', 10),

  // Paths
  sessionsRootDir: process.env.SESSIONS_ROOT_DIR || 'sessions',
  dataRootDir: process.env.DATA_ROOT_DIR || 'data',

  // Security
  apiKey: process.env.API_KEY || undefined,
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3001', 'http://localhost:4000'],

  // Proxy
  enableProxy: process.env.ENABLE_PROXY === 'true',
  globalProxyUrl: process.env.GLOBAL_PROXY_URL || '',
});
