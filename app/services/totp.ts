import crypto from 'node:crypto'

/**
 * Kode sekali pakai berbasis waktu (RFC 6238) di atas node:crypto, sehingga tidak perlu library
 * tambahan. Bawaan sama dengan aplikasi authenticator: SHA-1, 6 digit, periode 30 detik.
 * Diporting dari proyek revenue.
 */

const DIGITS = 6
const PERIOD_SECONDS = 30
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
// 20 byte = 160 bit, menghasilkan 32 karakter base32 (sama dengan google2fa di versi Laravel).
const SECRET_BYTES = 20

function base32Encode(buffer: Buffer): string {
    let bits = 0
    let value = 0
    let output = ''

    for (const byte of buffer) {
        value = (value << 8) | byte
        bits += 8

        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
            bits -= 5
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
    }

    return output
}

function base32Decode(input: string): Buffer {
    const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
    let bits = 0
    let value = 0
    const bytes: number[] = []

    for (const char of clean) {
        value = (value << 5) | BASE32_ALPHABET.indexOf(char)
        bits += 5

        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff)
            bits -= 8
        }
    }

    return Buffer.from(bytes)
}

function hotp(secret: Buffer, step: number): string {
    const counter = Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(step))

    const digest = crypto.createHmac('sha1', secret).update(counter).digest()
    const offset = digest[digest.length - 1] & 0x0f
    const binary =
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff)

    return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0')
}

function stepAt(atMs: number): number {
    return Math.floor(atMs / 1000 / PERIOD_SECONDS)
}

export function generateTotpSecret(): string {
    return base32Encode(crypto.randomBytes(SECRET_BYTES))
}

/**
 * Kode 6 digit untuk kunci ini pada waktu tertentu, seperti yang tampil di aplikasi authenticator.
 */
export function generateTotp(secretBase32: string, atMs = Date.now()): string {
    return hotp(base32Decode(secretBase32), stepAt(atMs))
}

/**
 * Periode (time-step) milik kode ini dengan toleransi `window` periode sebelum/sesudah untuk jam
 * ponsel yang sedikit meleset, atau null bila tidak cocok. Pemanggil wajib menolak periode yang
 * tidak lebih baru dari periode kode terakhir yang diterima (perlindungan replay).
 */
export function matchTotpStep(secretBase32: string, code: string, window = 1): number | null {
    if (!/^\d{6}$/.test(code)) {
        return null
    }

    const secret = base32Decode(secretBase32)
    const currentStep = stepAt(Date.now())
    const candidate = Buffer.from(code)

    for (let drift = -window; drift <= window; drift++) {
        if (crypto.timingSafeEqual(Buffer.from(hotp(secret, currentStep + drift)), candidate)) {
            return currentStep + drift
        }
    }

    return null
}

/**
 * Alamat otpauth:// yang dibaca aplikasi authenticator dari QR code.
 */
export function buildOtpauthUri(secret: string, accountLabel: string, issuer: string): string {
    const label = encodeURIComponent(`${issuer}:${accountLabel}`)
    const params = new URLSearchParams({
        secret,
        issuer,
        algorithm: 'SHA1',
        digits: String(DIGITS),
        period: String(PERIOD_SECONDS),
    })

    return `otpauth://totp/${label}?${params.toString()}`
}
