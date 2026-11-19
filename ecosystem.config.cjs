const path = require('node:path')

const cwd = path.join(__dirname, 'build')
const env = { NODE_ENV: 'production', ENV_PATH: '../' }

module.exports = {
    apps: [
        {
            name: 'cekcari-web',
            cwd,
            script: 'bin/server.js',
            env,
            exec_mode: 'fork',
            instances: 1,
            max_memory_restart: '512M',
            kill_timeout: 10_000,
            time: true,
        },
        {
            name: 'cekcari-queue',
            cwd,
            script: 'ace.js',
            args: 'queue:work',
            env,
            exec_mode: 'fork',
            instances: 1,
            max_memory_restart: '512M',
            kill_timeout: 60_000,
            exp_backoff_restart_delay: 1_000,
            time: true,
        },
    ],
}
