/**
 * Account Center hanya membuktikan "email + password ini sah". Akun lokal, aktivasi, peran,
 * dan 2FA tetap diputuskan oleh CekCari.
 */
export type AuthenticatedIdentity = {
    // Selalu huruf kecil: kunci penghubung ke tabel users.
    email: string
    name: string | null
    avatarUrl: string | null
}

export type AccountCenterResult =
    | { outcome: 'authenticated'; identity: AuthenticatedIdentity }
    | { outcome: 'rejected' }
    | { outcome: 'unavailable' }

export interface AccountCenterClient {
    authenticate(email: string, password: string): Promise<AccountCenterResult>
}

export function authenticatedResult(
    email: string,
    name: string | null,
    avatarUrl: string | null
): AccountCenterResult {
    return { outcome: 'authenticated', identity: { email: email.toLowerCase(), name, avatarUrl } }
}

export function rejectedResult(): AccountCenterResult {
    return { outcome: 'rejected' }
}

export function unavailableResult(): AccountCenterResult {
    return { outcome: 'unavailable' }
}
