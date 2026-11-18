import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'
import type { InferConnections } from '@adonisjs/redis/types'

const redisConfig = defineConfig({
    connection: 'main',
    connections: {
        main: {
            host: env.get('REDIS_HOST'),
            port: env.get('REDIS_PORT'),
            password: env.get('REDIS_PASSWORD')?.release(),
            db: 0,
            keyPrefix: env.get('REDIS_KEY_PREFIX') ?? 'cekcari:',
            retryStrategy(times) {
                return Math.min(times * 100, 2000)
            },
        },
    },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
    export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
