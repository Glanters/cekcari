<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Alamat tujuan bila link yang didaftarkan mengalihkan ke domain lain, untuk ditunjukkan ke pemilik.
    public function up(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->string('redirected_to', 2048)->nullable()->after('crawl_status');
        });
    }

    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->dropColumn('redirected_to');
        });
    }
};
