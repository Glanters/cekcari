<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Link yang ditandai pemiliknya sebagai promosi; satu di antaranya tampil di slot teratas pencarian.
    public function up(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->boolean('is_promoted')->default(false)->index()->after('logo_path');
        });
    }

    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table) {
            $table->dropColumn('is_promoted');
        });
    }
};
