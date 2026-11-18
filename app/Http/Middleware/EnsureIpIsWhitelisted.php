<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use App\Support\IpWhitelist;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Memutus sesi member yang memakai panel dari luar jaringan yang terdaftar di whitelist IP.
 */
class EnsureIpIsWhitelisted
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $ip = (string) $request->ip();

        if ($user !== null && ! IpWhitelist::allowsUser($user, $ip)) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return ApiResponse::error(IpWhitelist::rejectionMessage($ip), ['reason' => [IpWhitelist::REJECTION_REASON]], 403);
        }

        return $next($request);
    }
}
