<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Tampilan domain untuk pemiliknya di panel.
 */
class OwnedDomainResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url,
            'host' => $this->host,
            'title' => $this->title,
            'description' => $this->description,
            'logo_url' => $this->logo_url,
            'is_promoted' => $this->is_promoted,
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->pluck('name')->values()),
            'crawl_status' => $this->crawl_status->value,
            'redirected_to' => $this->redirected_to,
            'last_crawled_at' => $this->last_crawled_at?->toIso8601String(),
            'pages_count' => $this->whenCounted('pages'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
