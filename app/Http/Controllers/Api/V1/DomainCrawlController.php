<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnedDomainResource;
use App\Models\Domain;
use App\Services\DomainService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class DomainCrawlController extends Controller
{
    public function store(Request $request, Domain $domain, DomainService $domainService): JsonResponse
    {
        Gate::authorize('update', $domain);

        $domain = $domainService->requestCrawl($domain, $request->user());
        $domain->load('tags')->loadCount('pages');

        return ApiResponse::success(
            'Pembaruan data berhasil dijadwalkan',
            (new OwnedDomainResource($domain))->resolve($request),
            201,
        );
    }
}
