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
import type * as ai_hooks from "../ai/hooks.js";
import type * as asks_picker from "../asks/picker.js";
import type * as asks_rules from "../asks/rules.js";
import type * as auth from "../auth.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as demo_admin from "../demo/admin.js";
import type * as demo_behavior from "../demo/behavior.js";
import type * as demo_fixtures from "../demo/fixtures.js";
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
import type * as matching_admin from "../matching/admin.js";
import type * as matching_blossom from "../matching/blossom.js";
import type * as matching_config from "../matching/config.js";
import type * as matching_names from "../matching/names.js";
import type * as matching_pools from "../matching/pools.js";
import type * as matching_run from "../matching/run.js";
import type * as matching_taste from "../matching/taste.js";
import type * as matching_wake from "../matching/wake.js";
import type * as me from "../me.js";
import type * as onboarding from "../onboarding.js";
import type * as plans from "../plans.js";
import type * as plans_hooks from "../plans/hooks.js";
import type * as plans_model from "../plans/model.js";
import type * as plans_reconcile from "../plans/reconcile.js";
import type * as plans_release from "../plans/release.js";
import type * as schools from "../schools.js";
import type * as seed from "../seed.js";
import type * as services_claude from "../services/claude.js";
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
  "ai/hooks": typeof ai_hooks;
  "asks/picker": typeof asks_picker;
  "asks/rules": typeof asks_rules;
  auth: typeof auth;
  contacts: typeof contacts;
  crons: typeof crons;
  "demo/admin": typeof demo_admin;
  "demo/behavior": typeof demo_behavior;
  "demo/fixtures": typeof demo_fixtures;
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
  "matching/admin": typeof matching_admin;
  "matching/blossom": typeof matching_blossom;
  "matching/config": typeof matching_config;
  "matching/names": typeof matching_names;
  "matching/pools": typeof matching_pools;
  "matching/run": typeof matching_run;
  "matching/taste": typeof matching_taste;
  "matching/wake": typeof matching_wake;
  me: typeof me;
  onboarding: typeof onboarding;
  plans: typeof plans;
  "plans/hooks": typeof plans_hooks;
  "plans/model": typeof plans_model;
  "plans/reconcile": typeof plans_reconcile;
  "plans/release": typeof plans_release;
  schools: typeof schools;
  seed: typeof seed;
  "services/claude": typeof services_claude;
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
