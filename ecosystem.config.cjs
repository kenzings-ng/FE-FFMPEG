// PM2: chạy bản build của Nuxt, copy riêng sang .output-pm2 để `nuxi build` /
// `nuxi generate` chạy thử không ghi đè lên bản đang phục vụ (generate xóa hẳn
// .output/server).
// Với ssr: false, server Nitro chỉ trả file tĩnh + SPA shell cho mọi route
// (kể cả /videos/:id), nên không cần thêm static server nào khác.
//
//   npm run deploy                   # build + copy + pm2 reload
//   pm2 start ecosystem.config.cjs   # lần đầu
const fs = require('node:fs')
const path = require('node:path')
const { parseEnv } = require('node:util')

// Biến môi trường riêng của máy (NUXT_PUBLIC_API_BASE…) nằm trong .env (không commit).
const envFile = path.join(__dirname, '.env')
const localEnv = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {}

module.exports = {
  apps: [
    {
      name: 'fe-ffmpeg',
      script: '.output-pm2/server/index.mjs',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        // Chỉ nghe localhost: truy cập từ ngoài đi qua Cloudflare Tunnel.
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: 3000,
        // NUXT_PUBLIC_API_BASE… đọc lúc runtime (runtimeConfig), đổi .env rồi
        // `pm2 reload ecosystem.config.cjs --update-env`, không cần build lại.
        ...localEnv,
      },
    },
  ],
}
