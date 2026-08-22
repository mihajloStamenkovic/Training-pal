import 'dotenv/config';
import { z } from 'zod';

function parse<S extends z.ZodRawShape>(shape: S): z.infer<z.ZodObject<S>> {
  const result = z.object(shape).safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

/**
 * Everything that opens a connection reads this — the app pool and the
 * standalone migration runner alike.
 */
export const { DATABASE_URL } = parse({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

/**
 * The auth keys are a call rather than a module constant on purpose: only the
 * running server needs them, and `pnpm migrate` must not fail without them.
 */
export function requireAuthEnv() {
  return parse({
    CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
    CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
  });
}
