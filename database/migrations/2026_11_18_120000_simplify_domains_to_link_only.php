<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pemilik kini hanya mengisi link; data lain diambil otomatis dari situs dan domain langsung tampil.
 * Karena itu kategori dan verifikasi kepemilikan dihapus, dan satu host hanya boleh didaftarkan sekali.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP INDEX IF EXISTS domains_verified_host_unique');

        Schema::table('domains', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
            $table->dropColumn(['verification_token', 'verified_at']);
        });

        Schema::dropIfExists('categories');

        DB::statement('CREATE UNIQUE INDEX domains_host_unique ON domains (host) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS domains_host_unique');

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->string('slug', 80)->unique();
            $table->foreignId('created_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('domains', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->index()->constrained()->nullOnDelete();
            $table->string('verification_token', 64)->nullable();
            $table->timestamp('verified_at')->nullable()->index();
        });

        DB::statement('
            CREATE UNIQUE INDEX domains_verified_host_unique ON domains (host)
            WHERE verified_at IS NOT NULL AND deleted_at IS NULL
        ');
    }
};
