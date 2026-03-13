/**
 * ANVISA Bula Scraper - EXACT copy of Python implementation
 * Uses Playwright + Stealth + Webshare Proxy
 */

const { chromium } = require('playwright');
const { addExtra } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');

const browserExtra = addExtra(chromium);
browserExtra.use(stealth());

const BASE_URL = 'https://consultas.anvisa.gov.br';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function getProxyConfig() {
  const proxyUrl = process.env.WEBSHARE_PROXY_URL;
  if (!proxyUrl) {
    console.warn('[ANVISA] ⚠️  No proxy configured');
    return null;
  }
  
  try {
    const url = new URL(proxyUrl);
    return {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      username: url.username,
      password: url.password,
    };
  } catch (e) {
    return { server: proxyUrl };
  }
}

async function launchBrowser() {
  const proxy = getProxyConfig();
  const launchOptions = {
    executablePath: '/usr/bin/chromium-browser',
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
    console.log('[ANVISA Scraper] Using proxy:', proxy.server);
  } else {
    console.warn('[ANVISA Scraper] NO PROXY - ANVISA may block requests');
  }
  return browserExtra.launch(launchOptions);
}

async function createContext(browser, acceptDownloads = false) {
  return browser.newContext({
    locale: 'pt-BR',
    acceptDownloads: acceptDownloads,
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
  });
}

async function gotoBulario(page) {
  await page.goto(`${BASE_URL}/#/bulario/`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('[ng-submit]', { timeout: 15000 });
}

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
 * Download PDF - EXACT same as Python do_download_pdf
 */
async function downloadPdfWithPlaywright(drug, rowIndex = 0, tipo = 'paciente') {
  const col = tipo === 'paciente' ? 6 : 7;
  
  let browser = null;
  try {
    browser = await launchBrowser();
    const context = await createContext(browser, true);
    const page = await context.newPage();
    
    console.log('[ANVISA Scraper] Downloading PDF:', drug, tipo);
    
    // Navigate and search
    await gotoBulario(page);
    await injectSearch(page, drug);
    
    // Wait for results
    try {
      await page.waitForSelector('table tbody tr[ng-repeat]', { timeout: 20000 });
      console.log('[ANVISA Scraper] ✅ Search results found');
    } catch (err) {
      await browser.close();
      throw new Error('Nenhum resultado encontrado.');
    }
    
    // Build selector
    const selector = `table tbody tr[ng-repeat]:nth-child(${rowIndex + 1}) td:nth-child(${col}) a[ng-click]`;
    
    // Wait for PDF link
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      console.log('[ANVISA Scraper] ✅ PDF link found');
    } catch (err) {
      await browser.close();
      throw new Error(`Bula do ${tipo} não disponível para este medicamento.`);
    }
    
    // Click and download
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.locator(selector).click(),
    ]);
    
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const pdfBuffer = Buffer.concat(chunks);
    
    await browser.close();
    console.log('[ANVISA Scraper] ✅ PDF downloaded:', pdfBuffer.length, 'bytes');
    return pdfBuffer;
    
  } catch (error) {
    console.error('[ANVISA Scraper] ❌ Error:', error.message);
    if (browser) await browser.close();
    throw error;
  }
}

/**
 * Get PDF URL - same approach but doesn't download
 */
async function getPdfUrl(drug, rowIndex = 0, tipo = 'paciente') {
  let browser = null;
  try {
    browser = await launchBrowser();
    const context = await createContext(browser);
    const page = await context.newPage();
    
    await gotoBulario(page);
    await injectSearch(page, drug);
    
    try {
      await page.waitForSelector('table tbody tr[ng-repeat]', { timeout: 20000 });
    } catch (err) {
      throw new Error('Nenhum resultado encontrado.');
    }
    
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
    if (!pdfUrl) throw new Error('URL do PDF não encontrada.');
    return pdfUrl;
    
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

module.exports = { getPdfUrl, downloadPdfWithPlaywright };
