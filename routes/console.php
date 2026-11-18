<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('domains:recrawl')->weekly()->withoutOverlapping();
