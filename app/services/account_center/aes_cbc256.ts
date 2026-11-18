import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * AES-256-CBC yang sepadan dengan pustaka AesCbc256 milik Account Center (dipakai juga di dash CRM,
 * lacak-hp, dan revenue). Bentuknya memang tidak lazim: kunci = md5 heksadesimal dipakai sebagai
 * teks 32 byte (bukan didekode), IV = 16 karakter heksadesimal, hasil = base64 ganda. Harus persis
 * begini atau Account Center menolak tanda tangannya. Dijaga oleh test vektor PHP di
 * tests/unit/auth/account_center_crypto.spec.ts.
 */

const CIPHER = 'aes-256-cbc'

// String PHP adalah deretan byte; semua nilai yang lewat sini (kunci md5, IV heksadesimal) ASCII,
// jadi satu byte per karakter meniru PHP persis.
const PHP_BYTES: BufferEncoding = 'latin1'

export function keyFrom(secret: string): string {
    return createHash('md5').update(secret, 'utf8').digest('hex')
}

// Bentuk sama dengan versi PHP (16 karakter heksadesimal), tetapi dari CSPRNG.
export function generateIv(): string {
    return randomBytes(16).toString('hex').slice(0, 16)
}

export function encrypt(plaintext: string, key: string, iv: string): string {
    const cipher = createCipheriv(CIPHER, Buffer.from(key, PHP_BYTES), Buffer.from(iv, PHP_BYTES))
    // openssl_encrypt dengan options 0 sudah mengembalikan base64; PHP lalu membungkusnya base64 sekali lagi.
    const inner = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString(
        'base64'
    )

    return Buffer.from(inner, PHP_BYTES).toString('base64')
}

/**
 * Padanan openssl_decrypt: null (PHP: false) bila teks sandi atau kuncinya tidak cocok.
 */
export function decrypt(encoded: string, key: string, iv: string): string | null {
    const inner = Buffer.from(encoded, 'base64').toString(PHP_BYTES)

    try {
        const decipher = createDecipheriv(
            CIPHER,
            Buffer.from(key, PHP_BYTES),
            Buffer.from(iv, PHP_BYTES)
        )

        return Buffer.concat([
            decipher.update(Buffer.from(inner, 'base64')),
            decipher.final(),
        ]).toString('utf8')
    } catch (error) {
        if (
            error instanceof Error &&
            'code' in error &&
            String(error.code).startsWith('ERR_OSSL')
        ) {
            return null
        }

        throw error
    }
}
