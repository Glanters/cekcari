import { timingSafeEqual } from 'node:crypto'
import {
    type AccountCenterClient,
    type AccountCenterResult,
    authenticatedResult,
    rejectedResult,
} from '#services/accountCenter/accountCenterResult'

/**
 * Pengganti Account Center untuk masa uji (lokal/staging). Email apa pun diterima asalkan
 * password-nya sama dengan ACCOUNTCENTER_DUMMY_PASSWORD. Tidak pernah dipakai di production;
 * lihat selectAccountCenterClient().
 */
export class DummyAccountCenterClient implements AccountCenterClient {
    constructor(private readonly password: string) {}

    async authenticate(email: string, password: string): Promise<AccountCenterResult> {
        if (this.password === '' || !this.matches(password)) {
            return rejectedResult()
        }

        return authenticatedResult(email, this.nameFrom(email), null)
    }

    private matches(password: string): boolean {
        const expected = Buffer.from(this.password)
        const given = Buffer.from(password)

        return expected.length === given.length && timingSafeEqual(expected, given)
    }

    // "budi.santoso@contoh.id" → "Budi Santoso".
    private nameFrom(email: string): string {
        return email
            .split('@')[0]
            .replace(/[._-]/g, ' ')
            .toLowerCase()
            .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
    }
}
