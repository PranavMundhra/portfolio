import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error('Invalid path');
    const allowed = ['assets', 'projects', 'aisehack', 'resume'];
    const relative = path.relative(root, file);
    if (relative && relative !== 'index.html' && !allowed.includes(relative.split(path.sep)[0])) throw new Error('Not found');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Page not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
