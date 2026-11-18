<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SearchRequest;
use App\Http\Resources\SearchResultResource;
use App\Services\SearchService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class SearchResultController extends Controller
{
    public function index(SearchRequest $request, SearchService $searchService): JsonResponse
    {
        $outcome = $searchService->search(
            trim($request->validated('q')),
            $request->page(),
            $request->perPage(),
            $request->seed(),
        );

        return ApiResponse::paginated(
            'Hasil pencarian berhasil diambil',
            $outcome['paginator'],
            SearchResultResource::collection($outcome['paginator']->getCollection())->resolve($request),
            [
                'promoted' => $outcome['promoted'] ? (new SearchResultResource($outcome['promoted']))->resolve($request) : null,
                'is_fuzzy' => $outcome['isFuzzy'],
                'highlight' => ['start' => SearchService::HIGHLIGHT_START, 'end' => SearchService::HIGHLIGHT_END],
            ],
        );
    }
}
