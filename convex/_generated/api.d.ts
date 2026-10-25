/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as contacts from "../contacts.js";
import type * as events_admin from "../events/admin.js";
import type * as events_checks from "../events/checks.js";
import type * as events_config from "../events/config.js";
import type * as events_imports from "../events/imports.js";
import type * as events_item from "../events/item.js";
import type * as events_pool from "../events/pool.js";
import type * as events_venues from "../events/venues.js";
import type * as events_webhook from "../events/webhook.js";
import type * as help from "../help.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_clock from "../lib/clock.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_edu from "../lib/edu.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_format from "../lib/format.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_views from "../lib/views.js";
import type * as me from "../me.js";
import type * as onboarding from "../onboarding.js";
import type * as plans from "../plans.js";
import type * as schools from "../schools.js";
import type * as seed from "../seed.js";
import type * as services_apify from "../services/apify.js";
import type * as services_claude from "../services/claude.js";
import type * as services_geocode from "../services/geocode.js";
import type * as services_resend from "../services/resend.js";
import type * as services_voyage from "../services/voyage.js";
import type * as settings from "../settings.js";
import type * as spotify from "../spotify.js";
import type * as taste from "../taste.js";
import type * as week from "../week.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  contacts: typeof contacts;
  "events/admin": typeof events_admin;
  "events/checks": typeof events_checks;
  "events/config": typeof events_config;
  "events/imports": typeof events_imports;
  "events/item": typeof events_item;
  "events/pool": typeof events_pool;
  "events/venues": typeof events_venues;
  "events/webhook": typeof events_webhook;
  help: typeof help;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/clock": typeof lib_clock;
  "lib/config": typeof lib_config;
  "lib/edu": typeof lib_edu;
  "lib/errors": typeof lib_errors;
  "lib/format": typeof lib_format;
  "lib/validators": typeof lib_validators;
  "lib/views": typeof lib_views;
  me: typeof me;
  onboarding: typeof onboarding;
  plans: typeof plans;
  schools: typeof schools;
  seed: typeof seed;
  "services/apify": typeof services_apify;
  "services/claude": typeof services_claude;
  "services/geocode": typeof services_geocode;
  "services/resend": typeof services_resend;
  "services/voyage": typeof services_voyage;
  settings: typeof settings;
  spotify: typeof spotify;
  taste: typeof taste;
  week: typeof week;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  aiPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"aiPool">;
  emailPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"emailPool">;
  syncPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"syncPool">;
};
