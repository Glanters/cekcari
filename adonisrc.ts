import { indexEntities } from '@adonisjs/core/generators'
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
    experimental: {},

    commands: [
        () => import('@adonisjs/core/commands'),
        () => import('@adonisjs/lucid/commands'),
        () => import('@adonisjs/session/commands'),
    ],

    providers: [
        () => import('@adonisjs/core/providers/app_provider'),
        () => import('@adonisjs/core/providers/hash_provider'),
        {
            file: () => import('@adonisjs/core/providers/repl_provider'),
            environment: ['repl', 'test'],
        },
        () => import('@adonisjs/core/providers/vinejs_provider'),
        () => import('@adonisjs/core/providers/edge_provider'),
        () => import('@adonisjs/session/session_provider'),
        () => import('@adonisjs/vite/vite_provider'),
        () => import('@adonisjs/shield/shield_provider'),
        () => import('@adonisjs/static/static_provider'),
        () => import('@adonisjs/lucid/database_provider'),
        () => import('@adonisjs/auth/auth_provider'),
        () => import('@adonisjs/redis/redis_provider'),
        () => import('@adonisjs/limiter/limiter_provider'),
    ],

    preloads: [
        () => import('#start/routes'),
        () => import('#start/kernel'),
        () => import('#start/validator'),
        () => import('#start/limiter'),
    ],

    tests: {
        suites: [
            {
                files: ['tests/unit/**/*.spec.ts'],
                name: 'unit',
                timeout: 5000,
            },
            {
                files: ['tests/functional/**/*.spec.ts'],
                name: 'functional',
                timeout: 30000,
            },
        ],
        forceExit: false,
    },

    metaFiles: [
        { pattern: 'resources/views/**/*.edge', reloadServer: false },
        { pattern: 'public/**', reloadServer: false },
    ],

    hooks: {
        init: [indexEntities()],
        buildStarting: [() => import('@adonisjs/vite/build_hook')],
    },
})
