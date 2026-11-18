<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->index()->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->string('url', 255);
            $table->string('host', 255)->index();
            $table->string('title', 120);
            $table->text('description');
            $table->string('logo_path', 255)->nullable();
            $table->string('verification_token', 64);
            $table->timestamp('verified_at')->nullable()->index();
            $table->string('crawl_status', 20)->default('pending');
            $table->timestamp('last_crawled_at')->nullable();
            $table->foreignId('created_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        // Titik pada host diganti spasi agar "tokoku.com" juga cocok dengan pencarian "tokoku".
        DB::statement("
            ALTER TABLE domains ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('simple', replace(coalesce(host, ''), '.', ' ')), 'B') ||
                setweight(to_tsvector('simple', coalesce(description, '')), 'C')
            ) STORED
        ");
        DB::statement('CREATE INDEX domains_search_vector_index ON domains USING GIN (search_vector)');
        DB::statement('CREATE INDEX domains_title_trgm_index ON domains USING GIN (title gin_trgm_ops)');
        DB::statement('CREATE INDEX domains_host_trgm_index ON domains USING GIN (host gin_trgm_ops)');

        // Satu host hanya boleh dimiliki satu domain terverifikasi. Klaim yang belum terverifikasi
        // sengaja tidak mengunci host, supaya pemilik asli tetap bisa mendaftarkan domainnya.
        DB::statement('
            CREATE UNIQUE INDEX domains_verified_host_unique ON domains (host)
            WHERE verified_at IS NOT NULL AND deleted_at IS NULL
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('domains');
    }
};
