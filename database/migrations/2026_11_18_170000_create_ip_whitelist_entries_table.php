<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ip_whitelist_entries', function (Blueprint $table) {
            $table->id();
            // Alamat IP tunggal atau rentang CIDR (IPv4/IPv6), disimpan dalam bentuk baku.
            $table->string('value', 64)->unique();
            $table->string('label', 100)->nullable();
            $table->foreignId('created_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ip_whitelist_entries');
    }
};
