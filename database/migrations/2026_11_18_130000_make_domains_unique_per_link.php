<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Satu domain kini boleh punya beberapa entri dengan path berbeda (mis. dkwl.b-cdn.net/latoto-kl1
 * dan dkwl.b-cdn.net/latoto-kl2). Keunikan pindah dari host ke link lengkap; http dan https
 * dianggap link yang sama. Halaman hasil crawl unik per entri supaya entri yang berbagi host
 * tidak saling menimpa halaman.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP INDEX IF EXISTS domains_host_unique');
        DB::statement("CREATE UNIQUE INDEX domains_address_unique ON domains ((split_part(url, '://', 2))) WHERE deleted_at IS NULL");

        DB::statement('ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_url_unique');
        DB::statement('CREATE UNIQUE INDEX pages_domain_id_url_unique ON pages (domain_id, url)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS pages_domain_id_url_unique');
        DB::statement('ALTER TABLE pages ADD CONSTRAINT pages_url_unique UNIQUE (url)');

        DB::statement('DROP INDEX IF EXISTS domains_address_unique');
        DB::statement('CREATE UNIQUE INDEX domains_host_unique ON domains (host) WHERE deleted_at IS NULL');
    }
};
