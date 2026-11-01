import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default("file:./dev.db"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters").default("dev_jwt_access_secret_key_32_chars_long!"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters").default("dev_jwt_refresh_secret_key_32_chars_long!"),
  // AES-256 requires 32 bytes (256 bits). If provided as hex, length is 64; if UTF-8 string, length is 32.
  PAN_ENCRYPTION_KEY: z.string().min(16).default("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
  PAN_HMAC_KEY: z.string().min(16).default("dev_pan_hmac_secret_key_32_chars!"),
  OTP_HMAC_KEY: z.string().min(16).default("dev_otp_hmac_secret_key_32_chars!"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  SIMULATED_OTP: z.string().default("482913")
});

export type Env = z.infer<typeof EnvSchema>;

let validatedEnv: Env;

export function getEnv(): Env {
  if (!validatedEnv) {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      console.error("❌ Invalid environment configuration:", result.error.format());
      throw new Error("Invalid environment configuration. Process aborted.");
    }
    validatedEnv = result.data;
  }
  return validatedEnv;
}
