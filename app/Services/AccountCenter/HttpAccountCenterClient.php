<?php

namespace App\Services\AccountCenter;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Klien login Account Center (layanan akun terpusat perusahaan), sama protokolnya dengan dash CRM.
 * Jawaban yang bentuknya tidak dikenali SELALU ditolak: kegagalan seperti itu bisa terlihat
 * seperti login sukses dan tidak ada yang menyadarinya.
 */
class HttpAccountCenterClient implements AccountCenterClient
{
    private const LOGIN_PATH = '/auth/login';

    private const REJECTED_STATUSES = [401, 403, 422];

    public function authenticate(string $email, string $password): AccountCenterResult
    {
        if (! $this->isConfigured()) {
            Log::error('Account Center belum dikonfigurasi (ACCOUNTCENTER_URI harus https, NAME dan SECRET wajib diisi).');

            return AccountCenterResult::unavailable();
        }

        $key = AesCbc256::keyFrom($this->setting('secret'));
        $iv = AesCbc256::generateIv();

        // Tanda tangan dihitung atas teks badan ini persis, jadi badan dikirim apa adanya lewat withBody.
        $body = json_encode([
            'email' => $email,
            'password' => AesCbc256::encrypt($password, $key, $iv),
        ], JSON_THROW_ON_ERROR);

        try {
            $response = Http::timeout($this->timeoutSeconds())
                ->acceptJson()
                ->withHeaders([
                    'X-Client-Id' => $this->setting('name'),
                    'X-Client-Iv' => base64_encode($iv),
                    'Signature' => AesCbc256::encrypt($body, $key, $iv),
                ])
                ->withBody($body, 'application/json')
                ->post($this->loginUrl());
        } catch (ConnectionException $exception) {
            Log::warning('Account Center tidak dapat dihubungi saat login.', ['reason' => $exception->getMessage()]);

            return AccountCenterResult::unavailable();
        }

        return $this->readResponse($response, $email);
    }

    private function readResponse(Response $response, string $requestedEmail): AccountCenterResult
    {
        if ($response->serverError()) {
            return AccountCenterResult::unavailable();
        }

        if (in_array($response->status(), self::REJECTED_STATUSES, true)) {
            return AccountCenterResult::rejected();
        }

        $payload = $response->json();
        $identity = is_array($payload) && is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $email = is_string($identity['email'] ?? null) ? trim($identity['email']) : '';

        // Hanya jawaban sukses yang lengkap dan untuk email yang sama yang diterima.
        $isRecognised = $response->successful()
            && ($payload['success'] ?? null) === true
            && $email !== ''
            && mb_strtolower($email) === mb_strtolower($requestedEmail);

        if (! $isRecognised) {
            // Hanya status dan nama key yang dicatat, bukan isinya.
            Log::warning('Jawaban Account Center tidak dikenali; login ditolak.', [
                'status' => $response->status(),
                'keys' => is_array($payload) ? array_keys($payload) : null,
            ]);

            return AccountCenterResult::rejected();
        }

        return AccountCenterResult::authenticated(
            $email,
            $this->optionalString($identity['fullname'] ?? null),
            $this->optionalHttpUrl($identity['urlImage'] ?? null),
        );
    }

    private function isConfigured(): bool
    {
        // Wajib https karena password ikut terkirim (walau terenkripsi kunci bersama).
        return str_starts_with(strtolower($this->setting('uri')), 'https://')
            && $this->setting('name') !== ''
            && $this->setting('secret') !== '';
    }

    private function loginUrl(): string
    {
        $base = rtrim($this->setting('uri'), '/');

        return str_ends_with($base, self::LOGIN_PATH) ? $base : $base.self::LOGIN_PATH;
    }

    private function timeoutSeconds(): int
    {
        return max(1, (int) ceil(((int) config('services.accountcenter.timeout_ms')) / 1000));
    }

    private function setting(string $key): string
    {
        return trim((string) config("services.accountcenter.{$key}"));
    }

    private function optionalString(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    private function optionalHttpUrl(mixed $value): ?string
    {
        $url = $this->optionalString($value);

        return $url !== null && preg_match('#^https?://#i', $url) === 1 && mb_strlen($url) <= 2048 ? $url : null;
    }
}
