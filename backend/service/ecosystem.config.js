
module.exports = {
    apps: [{
      name: 'celvox-service',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      args: 'debug.config.json',
      node_args: '--enable-source-maps',
      // Auto-restart on crashes
      autorestart: true,
      // Maximum restart attempts
      max_restarts: 10,
      // Time window for max_restarts
      min_uptime: '10s',
      // Build before starting
      pre_start: 'npm run build',
      // Watch for file changes in development
      watch: false, // Set to true for development
      ignore_watch: ['node_modules', 'dist', '*.log'],
      // Logs
      log_file: './logs/service-combined.log',
      out_file: './logs/service-out.log',
      error_file: './logs/service-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Environment specific configs
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001
      }
    },
    {
      name: 'celvox-r-backend',
      script: './start_r_backend.sh',
      instances: 1,
      exec_mode: 'fork',
      cwd: '/root/celvox.co/backend',
      // Auto-restart on crashes
      autorestart: true,
      // Maximum restart attempts
      max_restarts: 10,
      // Time window for max_restarts
      min_uptime: '10s',
      // Environment variables for R
      env: {
        R_ENV: 'production',
        R_PROFILE_USER: '~/.Rprofile'
      },
      // Logs
      log_file: './logs/r-backend-combined.log',
      out_file: './logs/r-backend-out.log',
      error_file: './logs/r-backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Health check for R process
      health_check: {
        enabled: true,
        command: 'curl -f http://localhost:5555/health || exit 1',
        interval: 30000, // 30 seconds
        timeout: 5000,   // 5 seconds
        retries: 3
      },
      env_production: {
        R_ENV: 'production'
      },
      env_development: {
        R_ENV: 'development'
      }
    }]
  };