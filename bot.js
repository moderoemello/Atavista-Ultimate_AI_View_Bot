const puppeteer = require('puppeteer-core'); // Use puppeteer-core instead of puppeteer
const fs = require('fs');

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
];

const MAX_CONCURRENT_BROWSERS = 6; // Limit the number of concurrent browsers to 12
const BATCH_DELAY = 30000; // Delay between batches in milliseconds

let activeBrowsers = [];

const proxyFilePath = './proxy_list.txt'; // Hardcoded path to the proxy list file

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function visitWithProxy(proxy, url, retries = 3) {
    const userAgent = getRandomUserAgent();
    const delayTime = getRandomDelay(600, 1200) * 1000; // 10 to 20 minutes delay

    const [proxyHost, proxyPort, proxyUser, proxyPass] = proxy.split(':');

    try {
        console.log(`Launching browser with proxy ${proxy}`);
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome', // Path to Snap-installed Chromium
            args: [
                `--proxy-server=http://${proxyHost}:${proxyPort}`,
                `--user-agent=${userAgent}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-component-extensions-with-background-pages',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--disable-sync',
                '--metrics-recording-only',
                '--no-first-run',
                '--safebrowsing-disable-auto-update',
                '--enable-automation',
                '--password-store=basic',
                '--use-mock-keychain',
            ],
            timeout: 60000 // Increased timeout to 60 seconds
        });

        activeBrowsers.push(browser);

        const page = await browser.newPage();

        await page.authenticate({ username: proxyUser, password: proxyPass });

        // Block unnecessary requests
        await page.setRequestInterception(true);
        page.on('request', request => {
            const resourceType = request.resourceType();
            const blockedResources = ['image', 'stylesheet', 'font', 'media'];
            if (blockedResources.includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });

        console.log(`Visiting ${url} using proxy ${proxy} with user-agent "${userAgent}"`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log(`Successfully loaded ${url}`);
        await delay(delayTime);
        console.log(`Spent ${delayTime / 1000} seconds on ${url}`);

    } catch (err) {
        console.error(`Failed to use proxy ${proxy}:`, err.message);
        if (retries > 0) {
            console.log(`Retrying... (${retries} retries left)`);
            await visitWithProxy(proxy, url, retries - 1);
        } else {
            console.error(`Exhausted retries for proxy ${proxy}.`);
        }
    } finally {
        const index = activeBrowsers.indexOf(browser);
        if (index > -1) {
            activeBrowsers.splice(index, 1);
        }
        if (browser) {
            await browser.close();
        }
    }
}

async function startBot(url) {
    console.log(`Starting bot for URL: ${url} with proxy file: ${proxyFilePath}`);

    if (!fs.existsSync(proxyFilePath)) {
        console.error(`Proxy file not found: ${proxyFilePath}`);
        process.exit(1);
    }

    const proxies = fs.readFileSync(proxyFilePath, 'utf-8').split('\n').filter(Boolean);

    if (proxies.length === 0) {
        console.error(`No proxies found in file: ${proxyFilePath}`);
        process.exit(1);
    }

    console.log(`Loaded ${proxies.length} proxies from file.`);

    let index = 0;

    while (index < proxies.length) {
        if (activeBrowsers.length < MAX_CONCURRENT_BROWSERS) {
            const proxy = proxies[index];
            index += 1;

            visitWithProxy(proxy, url).catch(err => {
                console.error(`Error visiting with proxy: ${err.message}`);
            });

            console.log(`Added new viewer, total viewers: ${activeBrowsers.length}`);
        }

        await delay(getRandomDelay(2000, 4000));
    }

    console.log(`Reached the end of the proxy list.`);

    while (activeBrowsers.length > 0) {
        await delay(60000); // Check every minute to ensure the script keeps running
    }

    console.log(`All viewers have disconnected.`);
}

// Clean up browsers on process exit
function cleanUp() {
    console.log('Cleaning up browsers...');
    activeBrowsers.forEach(async browser => {
        try {
            await browser.close();
        } catch (err) {
            console.error(`Error during cleanup:`, err.message);
        }
    });
    process.exit();
}

process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);
process.on('exit', cleanUp);

// Capture command-line arguments
const [,, url] = process.argv;

console.log(`Command-line arguments: ${process.argv}`);

if (!url) {
    console.error('Usage: node bot.js <URL>');
    process.exit(1);
}

startBot(url);

module.exports = { startBot };
