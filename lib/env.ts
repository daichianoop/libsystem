import { z } from "zod";

const envSchema = z.object({
  // Supabase Public
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Valid Supabase URL is required").optional().default("https://jyggqnfmfeykopfmyykl.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional().default("mock_anon_key"),

  // Supabase Server
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional().default("mock_service_role_key"),

  // Session Secret
  SESSION_SECRET: z.string().default("hostel-library-pass-system-jwt-secret-key-2026"),

  // Initial Admin
  INITIAL_ADMIN_USERNAME: z.string().default("admin"),
  INITIAL_ADMIN_PASSWORD: z.string().default("admin123"),

  // Runtime
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const rawEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jyggqnfmfeykopfmyykl.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock_anon_key",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "mock_service_role_key",
    SESSION_SECRET: process.env.SESSION_SECRET || "hostel-library-pass-system-jwt-secret-key-2026",
    INITIAL_ADMIN_USERNAME: process.env.INITIAL_ADMIN_USERNAME || "admin",
    INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || "admin123",
    NODE_ENV: process.env.NODE_ENV || "development",
  };

  const parsed = envSchema.safeParse(rawEnv);
  return (parsed.success ? parsed.data : rawEnv) as Env;
}

export const env = getEnv();
