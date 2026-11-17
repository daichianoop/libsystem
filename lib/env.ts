import { z } from "zod";

const envSchema = z.object({
  // Clerk Public
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "Clerk Publishable Key is required"),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default("/"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default("/"),

  // Clerk Server
  CLERK_SECRET_KEY: z.string().min(1, "Clerk Secret Key is required"),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // Supabase Public
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Valid Supabase URL is required"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase Anon Key is required"),

  // Supabase Server
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Supabase Service Role Key is required"),

  // Initial Admin (optional for seed script)
  INITIAL_ADMIN_USERNAME: z.string().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().optional(),

  // Runtime
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  // Allow running vitest/mock mode with default test credentials if not configured
  const isTest = process.env.NODE_ENV === "test";

  const rawEnv = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || (isTest ? "pk_test_mock" : undefined),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/sign-in",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/sign-in",
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || "/",
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || "/",

    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || (isTest ? "sk_test_mock" : undefined),
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,

    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || (isTest ? "https://example.supabase.co" : undefined),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (isTest ? "anon_key_mock" : undefined),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || (isTest ? "service_role_key_mock" : undefined),

    INITIAL_ADMIN_USERNAME: process.env.INITIAL_ADMIN_USERNAME,
    INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD,

    NODE_ENV: process.env.NODE_ENV || "development",
  };

  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    // Format error message cleanly
    const errors = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    console.warn(`[Env Warning] Missing or invalid environment variables:\n${errors}`);
    // If not in build or production, return raw with cast to avoid blocking local file inspection
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[Env Error] Missing or invalid environment variables:\n${errors}`);
    }
  }

  return (parsed.success ? parsed.data : rawEnv) as Env;
}

export const env = getEnv();
