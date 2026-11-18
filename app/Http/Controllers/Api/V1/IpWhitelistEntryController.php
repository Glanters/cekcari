<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PaginationRequest;
use App\Http\Requests\StoreIpWhitelistEntryRequest;
use App\Http\Resources\IpWhitelistEntryResource;
use App\Models\IpWhitelistEntry;
use App\Support\ApiResponse;
use App\Support\IpWhitelist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class IpWhitelistEntryController extends Controller
{
    public function index(PaginationRequest $request): JsonResponse
    {
        Gate::authorize('manage-security');

        $paginator = IpWhitelistEntry::query()
            ->oldest()
            ->paginate($request->perPage(), ['*'], 'page', $request->page());

        return ApiResponse::paginated(
            'Whitelist IP berhasil diambil',
            $paginator,
            IpWhitelistEntryResource::collection($paginator->getCollection())->resolve($request),
        );
    }

    public function store(StoreIpWhitelistEntryRequest $request): JsonResponse
    {
        Gate::authorize('manage-security');

        if (IpWhitelistEntry::query()->count() >= IpWhitelist::MAX_ENTRIES) {
            $message = 'Whitelist sudah berisi '.IpWhitelist::MAX_ENTRIES.' alamat. Gabungkan beberapa alamat menjadi rentang CIDR.';

            return ApiResponse::error($message, ['value' => [$message]], 422);
        }

        $entry = IpWhitelistEntry::create([
            ...$request->validated(),
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);
        IpWhitelist::forgetCache();

        return ApiResponse::success("{$entry->value} ditambahkan ke whitelist", new IpWhitelistEntryResource($entry), 201);
    }

    public function destroy(Request $request, IpWhitelistEntry $entry): JsonResponse
    {
        Gate::authorize('manage-security');

        // Whitelist aktif yang kosong akan diam-diam terbuka untuk semua orang; minta dimatikan dulu secara sadar.
        if (IpWhitelist::isEnabled() && IpWhitelistEntry::query()->count() === 1) {
            return ApiResponse::error('Ini alamat terakhir di whitelist. Matikan whitelist IP dulu sebelum menghapusnya.', [], 422);
        }

        $entry->delete();
        IpWhitelist::forgetCache();

        return ApiResponse::success("{$entry->value} dihapus dari whitelist");
    }
}
