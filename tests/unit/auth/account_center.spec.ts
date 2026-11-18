import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import { accountCenter } from '#config/cekcari'
import { selectAccountCenterClient } from '#services/account_center/account_center'
import { decrypt, encrypt, keyFrom } from '#services/account_center/aes_cbc256'
import { DummyAccountCenterClient } from '#services/account_center/dummy_account_center_client'
import {
    type AccountCenterSettings,
    type LoginRequest,
    type LoginTransport,
    HttpAccountCenterClient,
    buildLoginRequest,
} from '#services/account_center/http_account_center_client'

type AesVector = { label: string; iv: string; plaintext: string; ciphertext: string }

type LoginPayloadVector = {
    label: string
    iv: string
    email: string
    password: string
    jsonBody: string
    signature: string
    headers: Record<string, string>
}

// Dihasilkan PHP 8.3 dengan pustaka Account Center; nilai rahasia di dalamnya khusus test.
const vectors = JSON.parse(
    readFileSync(
        new URL('../../fixtures/accountCenterPhpVectors.json', import.meta.url),
        'utf8'
    )
) as {
    secret: string
    key: string
    clientId: string
    aesVectors: AesVector[]
    loginPayloads: LoginPayloadVector[]
}

function settings(uri = 'https://akun.contoh.test'): AccountCenterSettings {
    return { uri, name: 'cekcari', secret: vectors.secret, timeoutMs: 8000 }
}

function respondWith(status: number, body: unknown): LoginTransport {
    return async () => ({ status, body: typeof body === 'string' ? body : JSON.stringify(body) })
}

test.group('Account Center: protokol', () => {
    test('mengenkripsi persis sama dengan pustaka Account Center', ({ assert }) => {
        const key = keyFrom(vectors.secret)

        assert.equal(key, vectors.key)

        for (const vector of vectors.aesVectors) {
            assert.equal(encrypt(vector.plaintext, key, vector.iv), vector.ciphertext, vector.label)
            assert.equal(decrypt(vector.ciphertext, key, vector.iv), vector.plaintext, vector.label)
        }
    })

    test('menyusun badan login dan tanda tangan sesuai vektor Account Center', ({ assert }) => {
        for (const payload of vectors.loginPayloads) {
            const request = buildLoginRequest(
                payload.email,
                payload.password,
                {
                    uri: 'https://akun.contoh.test',
                    name: vectors.clientId,
                    secret: vectors.secret,
                    timeoutMs: 8000,
                },
                payload.iv
            )

            assert.equal(request.body, payload.jsonBody, payload.label)
            assert.equal(request.headers['Signature'], payload.signature, payload.label)
            assert.equal(
                request.headers['X-Client-Id'],
                payload.headers['X-Client-Id'],
                payload.label
            )
            assert.equal(
                request.headers['X-Client-Iv'],
                payload.headers['X-Client-Iv'],
                payload.label
            )
        }
    })

    test('meng-escape "/" dan karakter non-ASCII seperti json_encode PHP', ({ assert }) => {
        const request = buildLoginRequest('ané@contoh.id', 'x', settings(), '0123456789abcdef')

        assert.isTrue(request.body.startsWith('{"email":"an\\u00e9@contoh.id"'))
        assert.notInclude(request.body.replace(/\\\//g, ''), '/')
    })

    test('mengirim permintaan bertanda tangan dan membaca identitas dari Account Center', async ({
        assert,
    }) => {
        const key = keyFrom(vectors.secret)
        const sent: LoginRequest[] = []
        const client = new HttpAccountCenterClient(
            settings('https://akun.contoh.test/'),
            async (request) => {
                sent.push(request)

                return {
                    status: 200,
                    body: JSON.stringify({
                        success: true,
                        message: 'Login successful.',
                        data: {
                            email: 'Rina@Contoh.id',
                            fullname: 'Rina Wati',
                            urlImage: 'https://cdn.contoh.id/rina.png',
                        },
                    }),
                }
            }
        )

        const result = await client.authenticate('rina@contoh.id', 'P@ss/word+1')

        assert.deepEqual(result, {
            outcome: 'authenticated',
            identity: {
                email: 'rina@contoh.id',
                name: 'Rina Wati',
                avatarUrl: 'https://cdn.contoh.id/rina.png',
            },
        })
        assert.lengthOf(sent, 1)

        const [request] = sent
        const iv = Buffer.from(request.headers['X-Client-Iv'], 'base64').toString('latin1')
        const body = JSON.parse(request.body)

        assert.equal(request.url, 'https://akun.contoh.test/auth/login')
        assert.equal(request.headers['X-Client-Id'], 'cekcari')
        assert.equal(decrypt(request.headers['Signature'], key, iv), request.body)
        assert.equal(decrypt(body.password, key, iv), 'P@ss/word+1')
    })

    const unclearAnswers: {
        label: string
        transport: LoginTransport
        expected: 'rejected' | 'unavailable'
    }[] = [
        {
            label: 'kata sandi salah (422)',
            transport: respondWith(422, { success: false, errors: ['Invalid'] }),
            expected: 'rejected',
        },
        { label: 'tidak berhak (401)', transport: respondWith(401, {}), expected: 'rejected' },
        { label: 'galat server (500)', transport: respondWith(500, {}), expected: 'unavailable' },
        {
            label: '200 tetapi success false',
            transport: respondWith(200, { success: false, data: { email: 'rina@contoh.id' } }),
            expected: 'rejected',
        },
        {
            label: '200 tanpa email',
            transport: respondWith(200, { success: true, data: [] }),
            expected: 'rejected',
        },
        {
            label: '200 untuk email lain',
            transport: respondWith(200, { success: true, data: { email: 'orang.lain@contoh.id' } }),
            expected: 'rejected',
        },
        {
            label: 'bukan JSON',
            transport: respondWith(200, '<html>ok</html>'),
            expected: 'rejected',
        },
        {
            label: 'koneksi gagal',
            transport: async () => {
                throw new Error('timeout')
            },
            expected: 'unavailable',
        },
    ]

    test('menolak atau menganggap tidak tersedia setiap jawaban yang bukan sukses jelas: {label}')
        .with(unclearAnswers)
        .run(async ({ assert }, { transport, expected }) => {
            const result = await new HttpAccountCenterClient(settings(), transport).authenticate(
                'rina@contoh.id',
                'salah'
            )

            assert.equal(result.outcome, expected)
        })

    test('tidak mengirim kata sandi ke Account Center yang bukan https', async ({ assert }) => {
        let isSent = false
        const client = new HttpAccountCenterClient(
            settings('http://akun.contoh.test'),
            async () => {
                isSent = true

                return { status: 200, body: '{}' }
            }
        )

        const result = await client.authenticate('rina@contoh.id', 'rahasia')

        assert.equal(result.outcome, 'unavailable')
        assert.isFalse(isSent)
    })

    test('memakai Account Center dummy hanya di luar production', ({ assert }) => {
        const dummyConfig = { ...accountCenter, driver: 'dummy' as const }

        assert.instanceOf(selectAccountCenterClient(dummyConfig, false), DummyAccountCenterClient)
        assert.instanceOf(selectAccountCenterClient(dummyConfig, true), HttpAccountCenterClient)
        assert.instanceOf(
            selectAccountCenterClient({ ...accountCenter, driver: 'http' as const }, false),
            HttpAccountCenterClient
        )
    })

    test('Account Center dummy menolak kata sandi lain dan kata sandi kosong', async ({
        assert,
    }) => {
        const wrongPassword = await new DummyAccountCenterClient('rahasia').authenticate(
            'a@contoh.id',
            'salah'
        )
        const emptyPassword = await new DummyAccountCenterClient('').authenticate('a@contoh.id', '')

        assert.equal(wrongPassword.outcome, 'rejected')
        assert.equal(emptyPassword.outcome, 'rejected')
        assert.deepEqual(
            await new DummyAccountCenterClient('rahasia').authenticate(
                'budi.santoso@contoh.id',
                'rahasia'
            ),
            {
                outcome: 'authenticated',
                identity: {
                    email: 'budi.santoso@contoh.id',
                    name: 'Budi Santoso',
                    avatarUrl: null,
                },
            }
        )
    })
})
