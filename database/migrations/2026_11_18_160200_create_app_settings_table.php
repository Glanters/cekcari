<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value');
            $table->foreignId('created_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Masa uji: 2FA dimatikan dulu atas permintaan pemilik. Superadmin menyalakannya dari dasbor
        // sebelum go-live. Bila baris ini hilang, kode menganggap 2FA wajib (aman secara bawaan).
        DB::table('app_settings')->insert([
            'key' => 'auth.two_factor_required',
            'value' => json_encode(false),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
