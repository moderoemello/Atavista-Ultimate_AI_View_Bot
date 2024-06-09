const puppeteer = require('puppeteer');
const fs = require('fs');

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function visitWithProxy(proxy, url) {
    const userAgent = getRandomUserAgent();
    const delayTime = getRandomDelay(30, 90) * 1000; // 30 to 90 seconds delay

    const [proxyHost, proxyPort, proxyUser, proxyPass] = proxy.split(':');

    const browser = await puppeteer.launch({
        args: [
            `--proxy-server=http://${proxyHost}:${proxyPort}`,
            `--user-agent=${userAgent}`
        ]
    });

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

    try {
        console.log(`Visiting ${url} using proxy ${proxy} with user-agent "${userAgent}"`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log(`Successfully loaded ${url}`);
        await delay(delayTime);
        console.log(`Spent ${delayTime / 1000} seconds on ${url}`);
    } catch (err) {
        console.error(`Failed to use proxy ${proxy}:`, err.message);
    } finally {
        await browser.close();
    }
}

async function startBot(url, proxyFilePath) {
    const proxies = fs.readFileSync(proxyFilePath, 'utf-8').split('\n').filter(Boolean);

    // Run multiple bots concurrently
    const tasks = proxies.map(proxy => visitWithProxy(proxy, url));
    await Promise.all(tasks);
}

module.exports = { startBot };
