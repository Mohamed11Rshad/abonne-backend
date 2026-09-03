import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';
export type DrizzleDB = PostgresJsDatabase<typeof schema>;

export const drizzleProvider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<DrizzleDB> => {
    const logger = new Logger('Drizzle');
    const connectionString =
      configService.get<string>('DATABASE_URL') ||
      'postgresql://postgres:postgres@localhost:5432/abonne_db';

    logger.log('Initializing PostgreSQL database connection with Drizzle ORM...');

    const client = postgres(connectionString, {
      max: configService.get<number>('DB_MAX_CONNECTIONS') || 10,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
    });

    return drizzle(client, {
      schema,
      logger: process.env.NODE_ENV === 'development',
    });
  },
};
