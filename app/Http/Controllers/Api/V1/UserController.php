<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserIndexRequest;
use App\Http\Resources\ManagedUserResource;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\LikePattern;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class UserController extends Controller
{
    public function index(UserIndexRequest $request): JsonResponse
    {
        Gate::authorize('manage-users');

        $keyword = $request->keyword();
        $pattern = LikePattern::contains($keyword);

        $paginator = User::query()
            ->with('roles')
            ->withCount('domains')
            ->when($keyword !== '', fn ($query) => $query->where(fn ($match) => $match
                ->whereLike('name', $pattern)
                ->orWhereLike('email', $pattern)))
            ->when($request->status() === UserIndexRequest::STATUS_PENDING, fn ($query) => $query->whereNull('activated_at'))
            ->when($request->status() === UserIndexRequest::STATUS_ACTIVE, fn ($query) => $query->whereNotNull('activated_at'))
            // Akun yang menunggu aktivasi ditaruh paling atas karena itulah yang perlu ditindaklanjuti.
            ->orderByRaw('activated_at IS NOT NULL')
            ->latest()
            ->paginate($request->perPage(), ['*'], 'page', $request->page());

        return ApiResponse::paginated(
            'Data pengguna berhasil diambil',
            $paginator,
            ManagedUserResource::collection($paginator->getCollection())->resolve($request),
            ['pending_count' => User::query()->whereNull('activated_at')->count()],
        );
    }
}
