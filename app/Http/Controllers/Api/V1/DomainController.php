<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\RemoteFetchException;
use App\Http\Controllers\Controller;
use App\Http\Requests\DomainIndexRequest;
use App\Http\Requests\DomainRequest;
use App\Http\Resources\OwnedDomainResource;
use App\Models\Domain;
use App\Services\DomainService;
use App\Support\ApiResponse;
use App\Support\LikePattern;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class DomainController extends Controller
{
    public function __construct(private readonly DomainService $domainService) {}

    public function index(DomainIndexRequest $request): JsonResponse
    {
        $keyword = $request->keyword();
        $pattern = LikePattern::contains($keyword);

        $paginator = $request->user()->domains()
            ->when($keyword !== '', fn ($query) => $query->where(fn ($match) => $match
                ->whereLike('title', $pattern)
                ->orWhereLike('url', $pattern)))
            ->with('tags')
            ->withCount('pages')
            ->latest()
            ->paginate($request->perPage(), ['*'], 'page', $request->page());

        return ApiResponse::paginated(
            'Data domain berhasil diambil',
            $paginator,
            OwnedDomainResource::collection($paginator->getCollection())->resolve($request),
        );
    }

    public function store(DomainRequest $request): JsonResponse
    {
        try {
            $domain = $this->domainService->create($request->user(), $request->validated('url'));
        } catch (RemoteFetchException $exception) {
            return $this->siteUnreachable($exception);
        }

        return ApiResponse::success('Domain berhasil ditambahkan', $this->present($domain), 201);
    }

    public function show(Domain $domain): JsonResponse
    {
        Gate::authorize('view', $domain);

        return ApiResponse::success('Data domain berhasil diambil', $this->present($domain));
    }

    public function update(DomainRequest $request, Domain $domain): JsonResponse
    {
        Gate::authorize('update', $domain);

        try {
            $domain = $this->domainService->update($domain, $request->user(), $request->validated('url'));
        } catch (RemoteFetchException $exception) {
            return $this->siteUnreachable($exception);
        }

        return ApiResponse::success('Domain berhasil diperbarui', $this->present($domain));
    }

    public function destroy(Request $request, Domain $domain): JsonResponse
    {
        Gate::authorize('delete', $domain);

        $this->domainService->delete($domain, $request->user());

        return ApiResponse::success('Domain berhasil dihapus');
    }

    // Situs yang tidak bisa dibaca diperlakukan sebagai isian link yang belum benar.
    private function siteUnreachable(RemoteFetchException $exception): JsonResponse
    {
        return ApiResponse::error($exception->getMessage(), ['url' => [$exception->getMessage()]], 422);
    }

    private function present(Domain $domain): array
    {
        $domain->load('tags')->loadCount('pages');

        return (new OwnedDomainResource($domain))->resolve();
    }
}
