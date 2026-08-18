import fs from 'fs';
import path from 'path';

const distPath = path.resolve('dist');

const routes = ['corporate', 'interactions', 'corporate-products', 'audit-logs'];

routes.forEach(route => {
  const routeDir = path.join(distPath, route);
  if (!fs.existsSync(routeDir)) {
    fs.mkdirSync(routeDir, { recursive: true });
  }
  fs.copyFileSync(path.join(distPath, 'index.html'), path.join(routeDir, 'index.html'));
  console.log(`Copied index.html to ${routeDir}/index.html`);
});
