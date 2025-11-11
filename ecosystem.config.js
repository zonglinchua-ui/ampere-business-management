module.exports = {
  apps: [{
    name: 'ampere-app',
    script: 'node_modules/next/dist/bin/next',
    args: 'dev',
    cwd: 'C:/ampere/ampere_business_management',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: 'postgresql://ampere_user:Ampere2024!@localhost:5433/ampere_db',
      NEXTAUTH_URL: 'https://czl-pc.tail2217a9.ts.net',
      NEXTAUTH_SECRET: 'ampere-secret-key-change-in-production'
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
