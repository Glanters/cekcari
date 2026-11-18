<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SearchResultResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url,
            'host' => $this->host,
            'title' => $this->title_highlight ?? $this->title,
            'description' => $this->description_highlight ?? $this->description,
            'logo_url' => $this->logo_url,
            'tags' => $this->tags->pluck('name')->values(),
            'related_pages' => $this->related_pages ?? [],
        ];
    }
}
