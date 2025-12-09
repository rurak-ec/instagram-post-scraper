/**
 * User agents realistas actualizados (2025)
 */
const USER_AGENTS = [
  // Chrome en Windows (más recientes)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',

  // Chrome en macOS (versiones recientes de macOS)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',

  // Chrome en Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',

  // Edge en Windows (también es Chromium)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
];

/**
 * Obtiene un user agent aleatorio pero realista
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

/**
 * Viewports comunes para parecer más humano
 */
const COMMON_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
];

export function getRandomViewport() {
  return COMMON_VIEWPORTS[Math.floor(Math.random() * COMMON_VIEWPORTS.length)]!;
}

/**
 * Resuelve la ruta del ejecutable de Chromium
 * Usa Chromium en todos los entornos
 */
export function resolveGoogleChromePath(): string {
  const envPath = process.env.CHROME_PATH;
  if (envPath) return envPath;

  const platform = process.platform;

  if (platform === 'linux') {
    return '/usr/bin/chromium';
  } else if (platform === 'darwin') {
    return '/Applications/Chromium.app/Contents/MacOS/Chromium';
  } else if (platform === 'win32') {
    return 'C:\\Program Files\\Chromium\\Application\\chrome.exe';
  }

  throw new Error(
    'No se pudo determinar la ruta de Chromium para esta plataforma',
  );
}

/**
 * Configuración optimizada del navegador con stealth
 * Usa Chromium en todos los entornos
 */
export function getBrowserLaunchOptions(headless: boolean) {
  const viewport = getRandomViewport();

  return {
    headless,
    viewport,
    bypassCSP: true,
    ignoreHTTPSErrors: true,

    // Use executable path from env
    executablePath: resolveGoogleChromePath(),

    // Args para mejor rendimiento y stealth
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer', // Add this to prevent GPU crashes

      // Performance optimizations
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',

      // Stealth
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-default-browser-check',
      '--no-first-run',
      '--disable-features=WindowsHello',
      '--suppress-message-center-popups',

      // Tamaño de ventana controlado por viewport
      `--window-size=${viewport.width},${viewport.height}`,
      '--mute-audio',
    ],

    // Locale y timezone para Ecuador
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',

    // Permisos de geolocalización
    permissions: ['geolocation'],
    geolocation: {
      latitude: -2.1709979, // Guayaquil
      longitude: -79.9223793,
      accuracy: 100,
    },

    // Simular viewport real
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  };
}

/**
 * Headers HTTP adicionales para parecer más real
 */
export function getRealisticHeaders() {
  return {
    'Accept-Language': 'es-EC,es;q=0.9,en;q=0.8',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };
}
