module.exports = {
  apps: [{
    name: 'paperless-ai',       // Application name
    script: 'server.js',        // Entry point of your application
    instances: 1,               // Number of instances to run (can be 'max' for production)
    autorestart: true,          // Automatically restart the app if it crashes
    watch: false,               // Enable/disable file watching
    max_memory_restart: '1G',   // Maximum memory usage before restarting
    env: {
      NODE_ENV: 'production',    // Environment variables for production
      // Add other production environment variables here
    },
    env_development: {
      NODE_ENV: 'development',  // Environment variables for development
      // Add development environment variables here
    },
    exp_backoff_restart_delay: 100, // Delay before restarting after an unexpected error
    error_file: 'logs/err.log',  // Path to the error log file
    out_file: 'logs/out.log',   // Path to the output log file
    combine_logs: true,         // Combine logs from different instances into one file
    time: true                  // Add timestamps to log entries
  }]
};
