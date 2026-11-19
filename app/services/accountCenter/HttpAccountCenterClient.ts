import axios from 'axios'
import logger from '@adonisjs/core/services/logger'
import { encrypt, generateIv, keyFrom } from '#services/accountCenter/aesCbc256'
import {
    type AccountCenterClient,
    type AccountCenterResult,
    authenticatedResult,
    rejectedResult,
    unavailableResult,
} from '#services/accountCenter/accountCenterResult'

/**
 * Klien login Account Center (layanan akun terpusat perusahaan), sama protokolnya dengan dash CRM.
 * Jawaban yang bentuknya tidak dikenali SELALU ditolak: kegagalan seperti itu bisa terlihat
 * seperti login sukses dan tidak ada yang menyadarinya.
 */

const LOGIN_PATH = '/auth/login'

const REJECTED_STATUSES = [401, 403, 422]

export type AccountCenterSettings = {
    uri: string
    name: string
    secret: string
    timeoutMs: number
}

export type LoginRequest = {
    url: string
    body: string
    headers: Record<string, string>
    timeoutMs: number
}

export type LoginResponse = { status: number; body: string }

// Dipisah supaya test bisa mengganti jaringan tanpa menyentuh logika protokol.
export type LoginTransport = (request: LoginRequest) => Promise<LoginResponse>

export const axiosTransport: LoginTransport = async ({ url, body, headers, timeoutMs }) => {
    const response = await axios.post<string>(url, body, {
        headers,
        timeout: timeoutMs,
        // Badan dikirim apa adanya: tanda tangan dihitung atas teks ini persis.
        transformRequest: [(data: string) => data],
        responseType: 'text',
        transformResponse: [(data: string) => data],
        validateStatus: () => true,
        // Password ikut terkirim, jadi tidak mengikuti pengalihan ke alamat lain.
        maxRedirects: 0,
    })

    return { status: response.status, body: typeof response.data === 'string' ? response.data : '' }
}

/**
 * Sama dengan json_encode() bawaan PHP untuk objek berisi teks: PHP meng-escape "/" dan karakter
 * non-ASCII (\uXXXX), JSON.stringify tidak. Tanpa ini tanda tangan tidak cocok.
 */
export function phpJsonEncode(value: Record<string, string>): string {
    return JSON.stringify(value)
        .replace(/\//g, '\\/')
        .replace(/[\u0080-￿]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

export function buildLoginUrl(uri: string): string {
    const base = uri.trim().replace(/\/+$/, '')

    return base.endsWith(LOGIN_PATH) ? base : `${base}${LOGIN_PATH}`
}

/**
 * Password dienkripsi di dalam badan, lalu seluruh badan dienkripsi lagi menjadi tanda tangan.
 * Urutan key (email lalu password) ikut menentukan tanda tangan.
 */
export function buildLoginRequest(
    email: string,
    password: string,
    settings: AccountCenterSettings,
    iv: string = generateIv()
): LoginRequest {
    const key = keyFrom(settings.secret)
    const body = phpJsonEncode({ email, password: encrypt(password, key, iv) })

    return {
        url: buildLoginUrl(settings.uri),
        body,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Client-Id': settings.name,
            'X-Client-Iv': Buffer.from(iv, 'latin1').toString('base64'),
            'Signature': encrypt(body, key, iv),
        },
        timeoutMs: settings.timeoutMs,
    }
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch (error) {
        if (error instanceof SyntaxError) {
            return null
        }

        throw error
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function optionalHttpUrl(value: unknown): string | null {
    const url = optionalString(value)

    return url !== null && /^https?:\/\//i.test(url) && url.length <= 2048 ? url : null
}

export class HttpAccountCenterClient implements AccountCenterClient {
    constructor(
        private readonly settings: AccountCenterSettings,
        private readonly transport: LoginTransport = axiosTransport
    ) {}

    async authenticate(email: string, password: string): Promise<AccountCenterResult> {
        if (!this.isConfigured()) {
            logger.error(
                'Account Center belum dikonfigurasi (ACCOUNTCENTER_URI harus https, NAME dan SECRET wajib diisi).'
            )

            return unavailableResult()
        }

        let response: LoginResponse

        try {
            response = await this.transport(buildLoginRequest(email, password, this.settings))
        } catch (error) {
            logger.warn(
                { reason: error instanceof Error ? error.message : String(error) },
                'Account Center tidak dapat dihubungi saat login.'
            )

            return unavailableResult()
        }

        return this.readResponse(response, email)
    }

    private readResponse(response: LoginResponse, requestedEmail: string): AccountCenterResult {
        if (response.status >= 500) {
            return unavailableResult()
        }

        if (REJECTED_STATUSES.includes(response.status)) {
            return rejectedResult()
        }

        const payload = parseJson(response.body)
        const identity = isRecord(payload) && isRecord(payload.data) ? payload.data : {}
        const email = typeof identity.email === 'string' ? identity.email.trim() : ''

        // Hanya jawaban sukses yang lengkap dan untuk email yang sama yang diterima.
        const isRecognised =
            response.status >= 200 &&
            response.status < 300 &&
            isRecord(payload) &&
            payload.success === true &&
            email !== '' &&
            email.toLowerCase() === requestedEmail.toLowerCase()

        if (!isRecognised) {
            // Hanya status dan nama key yang dicatat, bukan isinya.
            logger.warn(
                { status: response.status, keys: isRecord(payload) ? Object.keys(payload) : null },
                'Jawaban Account Center tidak dikenali; login ditolak.'
            )

            return rejectedResult()
        }

        return authenticatedResult(
            email,
            optionalString(identity.fullname),
            optionalHttpUrl(identity.urlImage)
        )
    }

    // Wajib https karena password ikut terkirim (walau terenkripsi kunci bersama).
    private isConfigured(): boolean {
        return (
            this.settings.uri.trim().toLowerCase().startsWith('https://') &&
            this.settings.name.trim() !== '' &&
            this.settings.secret.trim() !== ''
        )
    }
}
