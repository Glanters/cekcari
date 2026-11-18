<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->string('name', 40)->unique();
            $table->string('slug', 60)->unique();
            $table->timestamps();
        });

        DB::statement('CREATE INDEX tags_name_trgm_index ON tags USING GIN (name gin_trgm_ops)');

        Schema::create('domain_tag', function (Blueprint $table) {
            $table->id();
            $table->foreignId('domain_id')->index()->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->index()->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['domain_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_tag');
        Schema::dropIfExists('tags');
    }
};
