import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { DATABASE_URL } from '../env.js';

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied successfully');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await client.end();
}
