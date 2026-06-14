import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { randomBytes } from "crypto";

export type BackendMode = "local" | "supabase";

export type RuntimeConfig = {
  backendMode: BackendMode;
  setupEnabled: boolean;
  setupUsername: string;
  setupPassword: string;
  localAuthToken: string;
  appUrl: string;
  appTimezone: string;
  cronSecret: string;
  resendApiKey: string;
  emailFrom: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseSecretKey: string;
};

const DATA_DIR = join(process.cwd(), "data");
const CONFIG_PATH = join(DATA_DIR, "runtime-config.json");
const ENV_PATH = join(process.cwd(), ".env.local");

const defaultConfig: RuntimeConfig = {
  backendMode: "local",
  setupEnabled: true,
  setupUsername: "admin",
  setupPassword: "admin",
  localAuthToken: "",
  appUrl: "http://localhost:3000",
  appTimezone: "Europe/Warsaw",
  cronSecret: "",
  resendApiKey: "",
  emailFrom: "Cleaning Duty <noreply@example.com>",
  supabaseUrl: "",
  supabasePublishableKey: "",
  supabaseSecretKey: "",
};

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function createToken() {
  return randomBytes(32).toString("hex");
}

export function readRuntimeConfig(): RuntimeConfig {
  let fileConfig = {};
  try {
    ensureDataDir();
    if (existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch {
    fileConfig = {};
  }

  const merged: RuntimeConfig = {
    ...defaultConfig,
    ...fileConfig,
    backendMode:
      process.env.APP_BACKEND === "supabase" || process.env.APP_BACKEND === "local"
        ? process.env.APP_BACKEND
        : ((fileConfig as Partial<RuntimeConfig>).backendMode ?? defaultConfig.backendMode),
    appUrl: process.env.APP_URL || (fileConfig as Partial<RuntimeConfig>).appUrl || defaultConfig.appUrl,
    appTimezone:
      process.env.APP_TIMEZONE ||
      (fileConfig as Partial<RuntimeConfig>).appTimezone ||
      defaultConfig.appTimezone,
    cronSecret:
      process.env.CRON_SECRET ||
      (fileConfig as Partial<RuntimeConfig>).cronSecret ||
      defaultConfig.cronSecret,
    resendApiKey:
      process.env.RESEND_API_KEY ||
      (fileConfig as Partial<RuntimeConfig>).resendApiKey ||
      defaultConfig.resendApiKey,
    emailFrom:
      process.env.EMAIL_FROM ||
      (fileConfig as Partial<RuntimeConfig>).emailFrom ||
      defaultConfig.emailFrom,
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (fileConfig as Partial<RuntimeConfig>).supabaseUrl ||
      defaultConfig.supabaseUrl,
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      (fileConfig as Partial<RuntimeConfig>).supabasePublishableKey ||
      defaultConfig.supabasePublishableKey,
    supabaseSecretKey:
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      (fileConfig as Partial<RuntimeConfig>).supabaseSecretKey ||
      defaultConfig.supabaseSecretKey,
  };

  if (!merged.localAuthToken) {
    merged.localAuthToken = createToken();
    if (merged.backendMode === "local") {
      writeRuntimeConfig(merged);
    }
  }

  return merged;
}

export function writeRuntimeConfig(config: RuntimeConfig) {
  ensureDataDir();
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function updateRuntimeConfig(
  patch: Partial<RuntimeConfig> & {
    keepSupabaseSecret?: boolean;
    keepResendSecret?: boolean;
    keepCronSecret?: boolean;
  },
) {
  const current = readRuntimeConfig();
  const next: RuntimeConfig = {
    ...current,
    ...patch,
    localAuthToken: current.localAuthToken || createToken(),
    supabaseSecretKey: patch.keepSupabaseSecret
      ? current.supabaseSecretKey
      : (patch.supabaseSecretKey ?? current.supabaseSecretKey),
    resendApiKey: patch.keepResendSecret
      ? current.resendApiKey
      : (patch.resendApiKey ?? current.resendApiKey),
    cronSecret: patch.keepCronSecret
      ? current.cronSecret
      : (patch.cronSecret ?? current.cronSecret),
  };

  writeRuntimeConfig(next);
  writeEnvLocal(next);
  return next;
}

export function getConfigPath() {
  return CONFIG_PATH;
}

export function getDataDir() {
  ensureDataDir();
  return DATA_DIR;
}

export function writeEnvLocal(config: RuntimeConfig) {
  mkdirSync(dirname(ENV_PATH), { recursive: true });
  const lines = [
    `APP_BACKEND=${config.backendMode}`,
    `NEXT_PUBLIC_SUPABASE_URL=${config.supabaseUrl}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${config.supabasePublishableKey}`,
    `SUPABASE_SECRET_KEY=${config.supabaseSecretKey}`,
    `RESEND_API_KEY=${config.resendApiKey}`,
    `EMAIL_FROM=${JSON.stringify(config.emailFrom)}`,
    `APP_URL=${config.appUrl}`,
    `APP_TIMEZONE=${config.appTimezone}`,
    `CRON_SECRET=${config.cronSecret}`,
    "",
  ];
  writeFileSync(ENV_PATH, lines.join("\n"), "utf8");
}

export function publicRuntimeConfig() {
  const config = readRuntimeConfig();
  return {
    backendMode: config.backendMode,
    setupEnabled: config.setupEnabled,
    setupUsername: config.setupUsername,
    appUrl: config.appUrl,
    appTimezone: config.appTimezone,
    emailFrom: config.emailFrom,
    supabaseUrl: config.supabaseUrl,
    supabasePublishableKey: config.supabasePublishableKey,
    hasSupabaseSecretKey: Boolean(config.supabaseSecretKey),
    hasResendApiKey: Boolean(config.resendApiKey),
    hasCronSecret: Boolean(config.cronSecret),
    configPath: CONFIG_PATH,
    dataDir: DATA_DIR,
  };
}
