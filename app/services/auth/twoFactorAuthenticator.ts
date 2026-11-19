import crypto from 'node:crypto'
import QRCode from 'qrcode'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import env from '#start/env'
import User from '#models/user'
import { buildOtpauthUri, generateTotpSecret, matchTotpStep } from '#services/totp'

/**
 * Kode TOTP (Google Authenticator/Authy) dan recovery code untuk login dua langkah.
 */

// Toleransi ±1 periode (±30 detik) supaya jam ponsel yang sedikit meleset tetap diterima.
const WINDOW = 1

const RECOVERY_CODE_COUNT = 8

const RECOVERY_CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

const QR_SIZE = 220

// Batas per akun (bukan per login), supaya penebak tidak bisa mengulang login untuk mendapat jatah baru.
const MAX_FAILURES = 5

const LOCKOUT_SECONDS = 900

function failureLimiter() {
    return limiter.use({ requests: MAX_FAILURES, duration: LOCKOUT_SECONDS })
}

function failureKey(user: User): string {
    return `two-factor:failures:${user.id}`
}

export function generateSecret(): string {
    return generateTotpSecret()
}

// Data URI supaya QR bisa ditampilkan lewat <img> tanpa menyisipkan SVG mentah ke halaman.
export async function qrCodeDataUri(email: string, secret: string): Promise<string> {
    const svg = await QRCode.toString(buildOtpauthUri(secret, email, env.get('APP_NAME')), {
        type: 'svg',
        width: QR_SIZE,
        margin: 1,
    })

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export function isTotpCode(code: string): boolean {
    return /^\d{6}$/.test(code)
}

/**
 * Kode yang sama tidak bisa dipakai dua kali: hanya periode yang lebih baru dari kode terakhir
 * yang diterima. Periode dicatat lewat satu UPDATE bersyarat, jadi dari dua permintaan bersamaan
 * dengan kode yang sama hanya satu yang berhasil mengubah baris.
 */
export async function verifyCode(user: User, secret: string, code: string): Promise<boolean> {
    const step = matchTotpStep(secret, code, WINDOW)

    if (step === null) {
        return false
    }

    const updated = await db
        .from('users')
        .where('id', user.id)
        .where((query) =>
            query.whereNull('two_factor_last_step').orWhere('two_factor_last_step', '<', step)
        )
        .update({ two_factor_last_step: step }, ['id'])

    return updated.length > 0
}

export function generateRecoveryCodes(): string[] {
    const randomPart = () =>
        Array.from(
            { length: 5 },
            () => RECOVERY_CODE_ALPHABET[crypto.randomInt(RECOVERY_CODE_ALPHABET.length)]
        ).join('')

    return Array.from({ length: RECOVERY_CODE_COUNT }, () => `${randomPart()}-${randomPart()}`)
}

export function hashRecoveryCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => hash.make(code)))
}

/**
 * Recovery code hanya berlaku sekali. Baris pengguna dikunci (FOR UPDATE) selama pemeriksaan,
 * jadi dua permintaan bersamaan tidak bisa sama-sama memakai kode yang sama.
 */
export async function consumeRecoveryCode(user: User, code: string): Promise<boolean> {
    const normalized = code.trim().toLowerCase()

    return db.transaction(async (trx) => {
        const lockedUser = await User.query({ client: trx })
            .where('id', user.id)
            .forUpdate()
            .firstOrFail()
        const hashes = lockedUser.twoFactorRecoveryCodes ?? []

        for (const [index, storedHash] of hashes.entries()) {
            if (await hash.verify(storedHash, normalized)) {
                lockedUser.twoFactorRecoveryCodes = hashes.filter(
                    (_, position) => position !== index
                )
                await lockedUser.save()

                return true
            }
        }

        return false
    })
}

export async function isLockedOut(user: User): Promise<boolean> {
    return (await failureLimiter().remaining(failureKey(user))) <= 0
}

export async function lockoutMessage(user: User): Promise<string> {
    const minutes = Math.max(
        1,
        Math.ceil((await failureLimiter().availableIn(failureKey(user))) / 60)
    )

    return `Terlalu banyak kode 2FA salah untuk akun ini. Coba lagi dalam ${minutes} menit.`
}

export async function recordFailure(user: User): Promise<void> {
    await failureLimiter().increment(failureKey(user))
}

export async function clearFailures(user: User): Promise<void> {
    await failureLimiter().delete(failureKey(user))
}
