/// <reference types="astro/client" />

/**
 * Transitional runtime typing for the current Cloudflare/Astro integration.
 * Keep this narrow: it exists to describe runtime bindings already used by the app,
 * not to make arbitrary values type-safe by assertion.
 */
declare namespace App {
  interface Locals {
    runtime?: {
      env?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }
}

/**
 * The repository already uses a D1 binding in legacy dashboard paths without
 * installing Cloudflare Workers ambient types. Keep the legacy surface explicit
 * until those paths are migrated or @cloudflare/workers-types is adopted.
 */
type D1Database = any;
