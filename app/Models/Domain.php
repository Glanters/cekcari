<?php

namespace App\Models;

use App\Enums\CrawlStatus;
use Database\Factories\DomainFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'user_id',
    'url',
    'host',
    'title',
    'description',
    'logo_path',
    'is_promoted',
    'crawl_status',
    'redirected_to',
    'last_crawled_at',
    'created_by',
    'updated_by',
])]
#[Hidden(['search_vector'])]
class Domain extends Model
{
    /** @use HasFactory<DomainFactory> */
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'last_crawled_at' => 'datetime',
            'is_promoted' => 'boolean',
            'crawl_status' => CrawlStatus::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class)->withTimestamps();
    }

    public function pages(): HasMany
    {
        return $this->hasMany(Page::class);
    }

    // Sama dengan ekspresi indeks unik domains_address_unique: link tanpa skema.
    public function scopeWithAddress(Builder $query, string $address): Builder
    {
        return $query->whereRaw("split_part(url, '://', 2) = ?", [$address]);
    }

    protected function logoUrl(): Attribute
    {
        return Attribute::get(
            fn () => $this->logo_path ? Storage::disk('s3')->url($this->logo_path) : null,
        );
    }
}
