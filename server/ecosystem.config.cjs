// PM2 config for the VPS: `pm2 start ecosystem.config.cjs && pm2 save`
// Fork mode (not cluster): PM2's cluster mode can't load ES modules, and a
// single process keeps the reminder scheduler from firing twice.
module.exports = {
  apps: [
    {
      name: 'job-portal-api',
      script: 'src/index.js',
      cwd: __dirname,
      exec_mode: 'fork',
      node_args: '--env-file=.env',
      env: { NODE_ENV: 'production' },
    },
  ],
};
