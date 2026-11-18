<?php

return [
    /*
     * Alamat proxy/load balancer di depan aplikasi (dipisah koma, boleh CIDR), mis. "127.0.0.1" bila
     * memakai nginx di server yang sama. Hanya dari alamat ini header X-Forwarded-For dipercaya;
     * tanpa ini whitelist IP akan melihat IP proxy, bukan IP pengunjung. Kosong = tidak ada proxy.
     */
    'trusted_proxies' => env('TRUSTED_PROXIES', ''),
];
