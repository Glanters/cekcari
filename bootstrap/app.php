<?php

use App\Http\Middleware\AddSecurityHeaders;
use App\Http\Middleware\EnsureIpIsWhitelisted;
use App\Http\Middleware\EnsureUserIsActive;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->append(AddSecurityHeaders::class);
        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'ip-whitelist' => EnsureIpIsWhitelisted::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Semua kesalahan API dikembalikan dalam bentuk standar dengan pesan yang dapat dipahami pengguna.
        $exceptions->render(function (Throwable $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return match (true) {
                $exception instanceof ValidationException => ApiResponse::error(
                    'Isian belum sesuai. Periksa kembali kolom yang ditandai.',
                    $exception->errors(),
                    422,
                ),
                $exception instanceof AuthenticationException => ApiResponse::error('Silakan masuk terlebih dahulu.', [], 401),
                $exception instanceof AuthorizationException,
                $exception instanceof AccessDeniedHttpException => ApiResponse::error('Anda tidak berhak mengakses data ini.', [], 403),
                $exception instanceof ModelNotFoundException,
                $exception instanceof NotFoundHttpException => ApiResponse::error('Data tidak ditemukan.', [], 404),
                $exception instanceof ThrottleRequestsException => ApiResponse::error(
                    'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
                    [],
                    429,
                ),
                $exception instanceof TokenMismatchException => ApiResponse::error(
                    'Sesi Anda sudah kedaluwarsa. Muat ulang halaman lalu coba lagi.',
                    [],
                    419,
                ),
                $exception instanceof HttpException && $exception->getStatusCode() < 500 => ApiResponse::error(
                    'Permintaan tidak dapat diproses.',
                    [],
                    $exception->getStatusCode(),
                ),
                default => ApiResponse::error('Terjadi kesalahan pada server. Silakan coba lagi nanti.', [], 500),
            };
        });
    })->create();
