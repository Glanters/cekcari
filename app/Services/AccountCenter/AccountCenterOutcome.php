<?php

namespace App\Services\AccountCenter;

enum AccountCenterOutcome
{
    case Authenticated;
    case Rejected;
    case Unavailable;
}
