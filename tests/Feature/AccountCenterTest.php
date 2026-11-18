<?php

use App\Services\AccountCenter\AccountCenterClient;
use App\Services\AccountCenter\AccountCenterOutcome;
use App\Services\AccountCenter\AesCbc256;
use App\Services\AccountCenter\DummyAccountCenterClient;
use App\Services\AccountCenter\HttpAccountCenterClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

function accountCenterVectors(): array
{
    return json_decode(file_get_contents(base_path('tests/fixtures/accountCenterPhpVectors.json')), true, flags: JSON_THROW_ON_ERROR);
}

function configureAccountCenter(string $uri = 'https://akun.contoh.test'): void
{
    config([
        'services.accountcenter.uri' => $uri,
        'services.accountcenter.name' => 'cekcari',
        'services.accountcenter.secret' => accountCenterVectors()['secret'],
    ]);
}

it('mengenkripsi persis sama dengan pustaka Account Center', function () {
    $vectors = accountCenterVectors();
    $key = AesCbc256::keyFrom($vectors['secret']);

    expect($key)->toBe($vectors['key']);

    foreach ($vectors['aesVectors'] as $vector) {
        expect(AesCbc256::encrypt($vector['plaintext'], $key, $vector['iv']))->toBe($vector['ciphertext'])
            ->and(AesCbc256::decrypt($vector['ciphertext'], $key, $vector['iv']))->toBe($vector['plaintext']);
    }
});

it('menyusun badan login dan tanda tangan sesuai vektor Account Center', function () {
    $vectors = accountCenterVectors();
    $key = AesCbc256::keyFrom($vectors['secret']);

    foreach ($vectors['loginPayloads'] as $payload) {
        // Flag json_encode harus sama dengan yang dipakai HttpAccountCenterClient.
        $body = json_encode([
            'email' => $payload['email'],
            'password' => AesCbc256::encrypt($payload['password'], $key, $payload['iv']),
        ], JSON_THROW_ON_ERROR);

        expect($body)->toBe($payload['jsonBody'])
            ->and(AesCbc256::encrypt($body, $key, $payload['iv']))->toBe($payload['signature']);
    }
});

it('mengirim permintaan bertanda tangan dan membaca identitas dari Account Center', function () {
    configureAccountCenter('https://akun.contoh.test/');
    $key = AesCbc256::keyFrom(accountCenterVectors()['secret']);

    Http::fake(['akun.contoh.test/auth/login' => Http::response([
        'success' => true,
        'message' => 'Login successful.',
        'data' => ['email' => 'Rina@Contoh.id', 'fullname' => 'Rina Wati', 'urlImage' => 'https://cdn.contoh.id/rina.png'],
    ])]);

    $result = app(HttpAccountCenterClient::class)->authenticate('rina@contoh.id', 'P@ss/word+1');

    expect($result->outcome)->toBe(AccountCenterOutcome::Authenticated)
        ->and($result->email)->toBe('rina@contoh.id')
        ->and($result->name)->toBe('Rina Wati')
        ->and($result->avatarUrl)->toBe('https://cdn.contoh.id/rina.png');

    Http::assertSent(function (Request $request) use ($key) {
        $iv = base64_decode($request->header('X-Client-Iv')[0]);
        $body = json_decode($request->body(), true);

        return $request->url() === 'https://akun.contoh.test/auth/login'
            && $request->header('X-Client-Id')[0] === 'cekcari'
            && AesCbc256::decrypt($request->header('Signature')[0], $key, $iv) === $request->body()
            && AesCbc256::decrypt($body['password'], $key, $iv) === 'P@ss/word+1';
    });
});

it('menolak atau menganggap tidak tersedia setiap jawaban yang bukan sukses jelas', function (mixed $response, AccountCenterOutcome $expected) {
    configureAccountCenter();
    Http::fake(['akun.contoh.test/*' => $response]);

    expect(app(HttpAccountCenterClient::class)->authenticate('rina@contoh.id', 'salah')->outcome)->toBe($expected);
})->with([
    'kata sandi salah (422)' => [fn () => Http::response(['success' => false, 'errors' => ['Invalid']], 422), AccountCenterOutcome::Rejected],
    'tidak berhak (401)' => [fn () => Http::response([], 401), AccountCenterOutcome::Rejected],
    'galat server (500)' => [fn () => Http::response([], 500), AccountCenterOutcome::Unavailable],
    '200 tetapi success false' => [fn () => Http::response(['success' => false, 'data' => ['email' => 'rina@contoh.id']]), AccountCenterOutcome::Rejected],
    '200 tanpa email' => [fn () => Http::response(['success' => true, 'data' => []]), AccountCenterOutcome::Rejected],
    '200 untuk email lain' => [fn () => Http::response(['success' => true, 'data' => ['email' => 'orang.lain@contoh.id']]), AccountCenterOutcome::Rejected],
    'bukan JSON' => [fn () => Http::response('<html>ok</html>'), AccountCenterOutcome::Rejected],
    'koneksi gagal' => [fn () => Http::failedConnection('timeout'), AccountCenterOutcome::Unavailable],
]);

it('tidak mengirim kata sandi ke Account Center yang bukan https', function () {
    configureAccountCenter('http://akun.contoh.test');

    expect(app(HttpAccountCenterClient::class)->authenticate('rina@contoh.id', 'rahasia')->outcome)
        ->toBe(AccountCenterOutcome::Unavailable);

    Http::assertNothingSent();
});

it('memakai Account Center dummy hanya di luar production', function () {
    config(['services.accountcenter.driver' => 'dummy', 'services.accountcenter.dummy_password' => 'rahasia']);

    expect(app(AccountCenterClient::class))->toBeInstanceOf(DummyAccountCenterClient::class);

    app()->detectEnvironment(fn () => 'production');

    expect(app(AccountCenterClient::class))->toBeInstanceOf(HttpAccountCenterClient::class);
});

it('Account Center dummy menolak kata sandi lain dan kata sandi kosong', function () {
    expect((new DummyAccountCenterClient('rahasia'))->authenticate('a@contoh.id', 'salah')->isAuthenticated())->toBeFalse()
        ->and((new DummyAccountCenterClient(''))->authenticate('a@contoh.id', '')->isAuthenticated())->toBeFalse()
        ->and((new DummyAccountCenterClient('rahasia'))->authenticate('budi.santoso@contoh.id', 'rahasia')->name)->toBe('Budi Santoso');
});
