<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SessionStarter
{
    public function __construct(private readonly PendingLogin $pendingLogin) {}

    public function start(Request $request, User $user): void
    {
        $this->pendingLogin->forget($request);

        Auth::guard('web')->login($user);
        // ID sesi diganti setelah login untuk mencegah session fixation.
        $request->session()->regenerate();

        $user->forceFill(['last_login_at' => now()])->saveQuietly();
    }
}
