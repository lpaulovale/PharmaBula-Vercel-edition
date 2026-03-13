/**
 * ANVISA Bula Scraper with Playwright + Stealth + Webshare Proxy
 * 
 * ONLY for web scraping ANVISA to get PDF URLs.
 * The actual PDF streaming is done via simple HTTP fetch (no browser needed).
 * 
 * Usage:
 *   const { getPdfUrl } = require('./lib/anvisa-scraper');
 *   const pdfUrl = await getPdfUrl('paracetamol', 0, 'paciente');
 */

const { chromium } = require('playwright');
const { addExtra } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin
const browserExtra = addExtra(chromium);
browserExtra.use(stealth());

const BASE_URL = 'https://consultas.anvisa.gov.br';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Webshare proxy configuration (ONLY for scraping)
function getProxyConfig() {
  const proxyUrl = process.env.WEBSHARE_PROXY_URL;
  
  if (!proxyUrl) {
    console.warn('[ANVISA] ⚠️  No proxy configured. ANVISA may block requests.');
    return null;
  }
  
  // Parse proxy URL (format: http://username:password@host:port)
  try {
    const url = new URL(proxyUrl);
    return {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      username: url.username,
      password: url.password,
    };
  } catch (e) {
    // Simple format: host:port
    return {
      server: proxyUrl,
    };
  }
}

/**
 * Launch browser with Webshare proxy (ONLY for scraping ANVISA)
 */
async function launchBrowser() {
  const proxy = getProxyConfig();
  
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
    ],
  };
  
  if (proxy) {
    launchOptions.proxy = proxy;
  }
  
  return browserExtra.launch(launchOptions);
}

/**
 * Create browser context
 */
async function createContext(browser) {
  return browser.newContext({
    locale: 'pt-BR',
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
  });
}

/**
 * Navigate to Bulario and wait for Angular
 */
async function gotoBulario(page) {
  await page.goto(`${BASE_URL}/#/bulario/`, { 
    waitUntil: 'networkidle', 
    timeout: 45000 
  });
  await page.waitForSelector('[ng-submit]', { timeout: 15000 });
}

/**
 * Inject search into Angular scope
 */
async function injectSearch(page, drug) {
  await page.evaluate((drug) => {
    const scope = angular.element(document.querySelector('[ng-submit]')).scope();
    scope.filter = scope.filter || {};
    scope.filter.nomeProduto = drug;
    scope.consultar();
    scope.$apply();
  }, drug);
}

/**
 * Get PDF URL from ANVISA (this is the ONLY function you need)
 * Uses Webshare proxy to bypass ANVISA anti-bot
 * 
 * @param {string} drug - Medication name
 * @param {number} rowIndex - Index of the result (default: 0)
 * @param {string} tipo - 'paciente' or 'profissional' (default: 'paciente')
 * @returns {Promise<string>} Direct PDF URL from ANVISA
 */
async function getPdfUrl(drug, rowIndex = 0, tipo = 'paciente') {
  let browser = null;
  
  try {
    browser = await launchBrowser();
    const context = await createContext(browser);
    const page = await context.newPage();
    
    await gotoBulario(page);
    await injectSearch(page, drug);
    
    // Wait for results
    try {
      await page.waitForSelector('table tbody tr[ng-repeat]', { timeout: 20000 });
    } catch (err) {
      throw new Error('Nenhum resultado encontrado.');
    }
    
    // Extract PDF URL from ng-click
    const pdfUrl = await page.evaluate((rowIndex, tipo) => {
      const col = tipo === 'paciente' ? 6 : 7;
      const rows = document.querySelectorAll('table tbody tr[ng-repeat]');
      const row = rows[rowIndex];
      if (!row) return null;
      
      const tds = row.querySelectorAll('td');
      const link = tds[col]?.querySelector('a[ng-click]');
      
      if (link) {
        const ngClick = link.getAttribute('ng-click');
        const match = ngClick?.match(/visualizarPdf\('([^']+)'\)/);
        if (match && match[1]) {
          return `${BASE_URL}/api-bula${match[1]}`;
        }
      }
      return null;
    }, rowIndex, tipo);
    
    await browser.close();
    
    if (!pdfUrl) {
      throw new Error(`URL do PDF não encontrada.`);
    }
    
    return pdfUrl;
    
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

module.exports = {
  getPdfUrl,
};
