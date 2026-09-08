/// <reference types="astro/client" />

/**
 * Transitional runtime typing for the current Cloudflare/Astro integration.
 * Keep this intentionally narrow while legacy source files still reference locals.
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
 * Astro 6+ / @astrojs/cloudflare exposes Worker bindings through this virtual
 * module at runtime. Keep the declaration deliberately generic until generated
 * Cloudflare binding types become the repository-wide source of truth.
 */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
