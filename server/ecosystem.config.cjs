// PM2 config for the VPS: `pm2 start ecosystem.config.cjs && pm2 save`
// Run a single instance so the reminder scheduler doesn't fire twice.
module.exports = {
  apps: [{ name: 'job-portal-api', script: 'src/index.js', node_args: '--env-file=.env', instances: 1, env: { NODE_ENV: 'production' } }],
};
