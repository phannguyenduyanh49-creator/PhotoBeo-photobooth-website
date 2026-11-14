import { writeFileSync } from 'node:fs';
const input = process.argv[2];
if (!input) throw new Error('Dùng: node scripts/configure-vercel.mjs https://your-node-backend.example');
const url = new URL(input);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('Cần HTTPS origin của backend, không có secret, path hoặc query.');
const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json', framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist',
  rewrites: [{ source: '/api/:path*', destination: url.origin + '/api/:path*' }, { source: '/memory-wall', destination: '/index.html' }],
};
writeFileSync('vercel.json', JSON.stringify(config, null, 2) + '\n');
console.log('Đã cấu hình API proxy. Đặt FRONTEND_ORIGIN trên backend bằng domain frontend HTTPS chính xác.');
