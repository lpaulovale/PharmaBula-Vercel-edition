/**
 * ANVISA Bula Scraper with Playwright + Stealth + Webshare Proxy
 * EXACT same approach as the Python version that works!
 * 
 * Usage:
 *   const { downloadPdfWithPlaywright } = require('./anvisa-scraper');
 *   const pdfBuffer = await downloadPdfWithPlaywright('paracetamol', 0, 'paciente');
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
 * Launch browser with Webshare proxy (using system chromium)
 */
async function launchBrowser() {
  const proxy = getProxyConfig();
  
  const launchOptions = {
    executablePath: '/usr/bin/chromium-browser',  // Use system chromium from apk
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
async function createContext(browser, acceptDownloads = false) {
  return browser.newContext({
    locale: 'pt-BR',
    acceptDownloads: acceptDownloads,
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
 * Download PDF using Playwright + Stealth (EXACT same approach as Python version)
 * This bypasses Cloudflare by using real browser + stealth
 * 
 * @param {string} drug - Medication name
 * @param {number} rowIndex - Index of result (default: 0)
 * @param {string} tipo - 'paciente' or 'profissional' (default: 'paciente')
 * @returns {Promise<Buffer>} PDF buffer
 */
async function downloadPdfWithPlaywright(drug, rowIndex = 0, tipo = 'paciente') {
  let browser = null;
  
  try {
    browser = await launchBrowser();
    const context = await createContext(browser, true); // accept downloads
    const page = await context.newPage();
    
    console.log('[ANVISA Scraper] Downloading PDF with Playwright + Stealth...');
    
    // Navigate to Bulario
    await gotoBulario(page);
    await injectSearch(page, drug);
    
    // Wait for results
    try {
      await page.waitForSelector('table tbody tr[ng-repeat]', { timeout: 20000 });
    } catch (err) {
      await browser.close();
      throw new Error('Nenhum resultado encontrado.');
    }
    
    // Get the column index (6 = paciente, 7 = profissional)
    const col = tipo === 'paciente' ? 6 : 7;
    
    // Build selector for the PDF link
    const selector = `table tbody tr[ng-repeat]:nth-child(${rowIndex + 1}) td:nth-child(${col}) a[ng-click]`;
    
    // Wait for the PDF link
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
    } catch (err) {
      await browser.close();
      throw new Error(`Bula do ${tipo} não disponível para este medicamento.`);
    }
    
    // Click and wait for download (EXACT same as Python)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.locator(selector).click(),
    ]);
    
    // Save to temp buffer
    const pdfBuffer = await download.createReadStream().then(stream => {
      return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    });
    
    await browser.close();
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF download returned empty');
    }
    
    console.log('[ANVISA Scraper] ✅ PDF downloaded:', pdfBuffer.length, 'bytes');
    return pdfBuffer;
    
  } catch (error) {
    console.error('[ANVISA Scraper] PDF download failed:', error.message);
    if (browser) await browser.close();
    throw error;
  }
}

/**
 * Get PDF URL from ANVISA (uses Webshare proxy + Playwright for scraping)
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
    console.error('[ANVISA Scraper] Get PDF URL failed:', error.message);
    if (browser) await browser.close();
    throw error;
  }
}

module.exports = {
  getPdfUrl,
  downloadPdfWithPlaywright,
};
