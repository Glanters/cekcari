<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('domain_id')->index()->constrained()->cascadeOnDelete();
            $table->string('url', 2048)->unique();
            $table->string('title', 255)->nullable();
            $table->text('description')->nullable();
            $table->text('content')->nullable();
            $table->unsignedSmallInteger('http_status');
            $table->timestamp('crawled_at');
            $table->timestamps();
        });

        DB::statement("
            ALTER TABLE pages ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(content, '')), 'D')
            ) STORED
        ");
        DB::statement('CREATE INDEX pages_search_vector_index ON pages USING GIN (search_vector)');
    }

    public function down(): void
    {
        Schema::dropIfExists('pages');
    }
};
