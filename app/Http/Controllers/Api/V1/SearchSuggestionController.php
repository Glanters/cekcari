<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SearchService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchSuggestionController extends Controller
{
    private const MIN_KEYWORD_LENGTH = 2;

    public function index(Request $request, SearchService $searchService): JsonResponse
    {
        $validated = $request->validate(['q' => ['nullable', 'string', 'max:100']]);
        $keyword = trim($validated['q'] ?? '');

        $suggestions = mb_strlen($keyword) >= self::MIN_KEYWORD_LENGTH ? $searchService->suggest($keyword) : [];

        return ApiResponse::success('Saran pencarian berhasil diambil', ['items' => $suggestions]);
    }
}
