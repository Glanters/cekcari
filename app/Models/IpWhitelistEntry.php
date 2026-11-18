<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['value', 'label', 'created_by', 'updated_by'])]
class IpWhitelistEntry extends Model {}
