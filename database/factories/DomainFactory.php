<?php

namespace Database\Factories;

use App\Enums\CrawlStatus;
use App\Models\Domain;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Domain>
 */
class DomainFactory extends Factory
{
    public function definition(): array
    {
        $host = fake()->unique()->domainName();

        return [
            'user_id' => User::factory(),
            'url' => 'https://'.$host,
            'host' => $host,
            'title' => fake()->company(),
            'description' => fake()->sentence(12),
            'crawl_status' => CrawlStatus::Done,
        ];
    }
}
