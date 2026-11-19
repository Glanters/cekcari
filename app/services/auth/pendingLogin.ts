import type { Session } from '@adonisjs/session'
import encryption from '@adonisjs/core/services/encryption'
import User from '#models/user'

/**
 * Login yang sudah lolos Account Center tetapi belum lolos 2FA. Disimpan di sesi server
 * (bukan dikirim ke browser), berlaku singkat, dan dibatalkan setelah terlalu banyak kode salah.
 */

const SESSION_KEY = 'pending_login'

const TTL_SECONDS = 10 * 60

const MAX_FAILED_ATTEMPTS = 5

type PendingLoginState = {
    userId: number
    setupSecret: string | null
    expiresAt: number
    failedAttempts: number
}

function nowInSeconds(): number {
    return Math.floor(Date.now() / 1000)
}

function current(session: Session): PendingLoginState | null {
    const pending = session.get(SESSION_KEY) as PendingLoginState | undefined

    if (!pending || pending.expiresAt < nowInSeconds()) {
        return null
    }

    return pending
}

export function startPendingLogin(
    session: Session,
    user: User,
    setupSecret: string | null = null
): void {
    const state: PendingLoginState = {
        userId: user.id,
        // Kunci yang belum dikonfirmasi tetap dienkripsi, karena store sesi bisa berupa Redis.
        setupSecret: setupSecret === null ? null : encryption.encrypt(setupSecret),
        expiresAt: nowInSeconds() + TTL_SECONDS,
        failedAttempts: 0,
    }

    session.put(SESSION_KEY, state)
}

export async function pendingLoginUser(session: Session): Promise<User | null> {
    const pending = current(session)

    return pending === null ? null : User.find(pending.userId)
}

export function pendingSetupSecret(session: Session): string | null {
    const encrypted = current(session)?.setupSecret ?? null

    return encrypted === null ? null : encryption.decrypt<string>(encrypted)
}

/**
 * Mencatat kode yang salah. Mengembalikan false bila batas percobaan sudah habis
 * (login yang tertunda langsung dibatalkan).
 */
export function recordFailedAttempt(session: Session): boolean {
    const pending = current(session)

    if (pending === null) {
        return false
    }

    pending.failedAttempts++

    if (pending.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        forgetPendingLogin(session)

        return false
    }

    session.put(SESSION_KEY, pending)

    return true
}

export function forgetPendingLogin(session: Session): void {
    session.forget(SESSION_KEY)
}
