const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-web-security'] });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setBypassCSP(true);
    
    console.log("Navigating...");
    await page.goto('http://localhost:3001/sportsbetting/sports/prematch/football', {waitUntil: 'networkidle2', timeout: 60000});
    
    console.log("Waiting 15 seconds...");
    await new Promise(r => setTimeout(r, 15000));
    
    // Evaluate DOM
    const result = await page.evaluate(() => {
        const container = document.getElementById('betting__container');
        if (!container) return "No container";
        
        function simplify(node, depth) {
            if (depth > 6) return null; // Limit depth to find the main layout
            
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.nodeValue.trim();
                return text ? text : null;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return null;
            
            const obj = { tag: node.tagName };
            if (node.className && typeof node.className === 'string') obj.classes = node.className;
            
            const children = [];
            for (let child of node.childNodes) {
                const s = simplify(child, depth + 1);
                if (s) children.push(s);
            }
            if (children.length > 0) obj.children = children;
            return obj;
        }
        return simplify(container, 0);
    });
    
    fs.writeFileSync('dom.json', JSON.stringify(result, null, 2));
    console.log("Saved dom.json");

    await browser.close();
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
