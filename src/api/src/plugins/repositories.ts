/**
 * Repositories Plugin
 *
 * Registers repository instances as Fastify decorators for dependency injection.
 * Each repository gets access to the PostgreSQL connection via fastify.pg.
 */

import { FastifyInstance } from 'fastify';
import { CallsRepository } from '../../services/repositories/calls.repository.js';
import { ProviderRegistryRepository } from '../../services/repositories/provider-registry.repository.js';
import { HealthChecksRepository } from '../../services/repositories/health-checks.repository.js';
import { MissionsRepository } from '../../services/repositories/missions.repository.js';
import { AdminRepository } from '../../services/repositories/admin.repository.js';
import { TelecomUsageRepository } from '../../services/repositories/telecom-usage.repository.js';
import { SessionsRepository } from '../../services/repositories/sessions.repository.js';
import { FailoverRepository } from '../../services/repositories/failover.repository.js';
import { UsersRepository } from '../../services/repositories/users.repository.js';
import { DemoRepository } from '../../services/repositories/demo.repository.js';

export interface Repositories {
  calls: CallsRepository;
  providerRegistry: ProviderRegistryRepository;
  healthChecks: HealthChecksRepository;
  missions: MissionsRepository;
  admin: AdminRepository;
  telecomUsage: TelecomUsageRepository;
  sessions: SessionsRepository;
  failover: FailoverRepository;
  users: UsersRepository;
  demo: DemoRepository;
}

export async function repositoriesPlugin(fastify: FastifyInstance) {
  const db = (fastify as any).pg;

  const repositories: Repositories = {
    calls: new CallsRepository(db),
    providerRegistry: new ProviderRegistryRepository(db),
    healthChecks: new HealthChecksRepository(db),
    missions: new MissionsRepository(db),
    admin: new AdminRepository(db),
    telecomUsage: new TelecomUsageRepository(db),
    sessions: new SessionsRepository(db),
    failover: new FailoverRepository(db),
    users: new UsersRepository(db),
    demo: new DemoRepository(db),
  };

  fastify.decorate('repositories', repositories);
}

declare module 'fastify' {
  interface FastifyInstance {
    repositories: Repositories;
  }
}
