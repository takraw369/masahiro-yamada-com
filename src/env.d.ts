/// <reference types="astro/client" />

/**
 * Transitional runtime typing for the current Cloudflare/Astro integration.
 * Keep this intentionally narrow. Legacy D1 typing remains legacy debt and is not
 * redefined here because ambient D1 declarations can change diagnostics in files
 * outside this release.
 */
declare namespace App {
  interface Locals {
    runtime?: {
      env?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }
}
