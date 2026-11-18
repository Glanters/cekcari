<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateDomainPromotionRequest;
use App\Http\Resources\OwnedDomainResource;
use App\Models\Domain;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class DomainPromotionController extends Controller
{
    public function update(UpdateDomainPromotionRequest $request, Domain $domain): JsonResponse
    {
        Gate::authorize('update', $domain);

        $isPromoted = $request->boolean('is_promoted');

        DB::transaction(fn () => $domain->update([
            'is_promoted' => $isPromoted,
            'updated_by' => $request->user()->id,
        ]));

        $domain->load('tags')->loadCount('pages');

        return ApiResponse::success(
            $isPromoted ? 'Link sekarang dipromosikan' : 'Promosi link dihentikan',
            (new OwnedDomainResource($domain))->resolve($request),
        );
    }
}
