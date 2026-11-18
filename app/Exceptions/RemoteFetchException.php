<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Kegagalan mengambil halaman situs milik user. Pesannya aman ditampilkan ke pengguna.
 */
class RemoteFetchException extends RuntimeException {}
