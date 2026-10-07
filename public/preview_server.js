const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const assetsRoot = path.resolve(__dirname, '..', 'assets');
const host = '127.0.0.1';
const port = 4173;
const noCacheTextHeaders = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache'
};
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  const requested = pathname === '/' ? '/system_preview.html' : pathname;
  const servesProjectAsset = requested === '/assets' || requested.startsWith('/assets/');
  const serveRoot = servesProjectAsset ? assetsRoot : root;
  const relativePath = servesProjectAsset ? requested.replace(/^\/assets\/?/, '') : requested.replace(/^\//, '');
  const filePath = path.resolve(serveRoot, relativePath);

  if (filePath !== serveRoot && !filePath.startsWith(`${serveRoot}${path.sep}`)) {
    response.writeHead(403, noCacheTextHeaders).end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, noCacheTextHeaders).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(response);
  });
}).listen(port, host, () => {
  console.log(`Mianyu preview: http://${host}:${port}/system_preview.html`);
});
