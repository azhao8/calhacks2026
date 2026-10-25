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
import type * as admin_demo from "../admin/demo.js";
import type * as admin_events from "../admin/events.js";
import type * as admin_matching from "../admin/matching.js";
import type * as admin_queue from "../admin/queue.js";
import type * as admin_students from "../admin/students.js";
import type * as ai_hooks from "../ai/hooks.js";
import type * as ai_labels from "../ai/labels.js";
import type * as ai_taste from "../ai/taste.js";
import type * as asks_close from "../asks/close.js";
import type * as asks_picker from "../asks/picker.js";
import type * as asks_rules from "../asks/rules.js";
import type * as auth from "../auth.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as demo_admin from "../demo/admin.js";
import type * as demo_behavior from "../demo/behavior.js";
import type * as demo_fixtures from "../demo/fixtures.js";
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
import type * as lib_normalize from "../lib/normalize.js";
import type * as lib_pools from "../lib/pools.js";
import type * as lib_registered from "../lib/registered.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_views from "../lib/views.js";
import type * as matching_admin from "../matching/admin.js";
import type * as matching_blossom from "../matching/blossom.js";
import type * as matching_config from "../matching/config.js";
import type * as matching_names from "../matching/names.js";
import type * as matching_run from "../matching/run.js";
import type * as matching_taste from "../matching/taste.js";
import type * as matching_wake from "../matching/wake.js";
import type * as me from "../me.js";
import type * as onboarding from "../onboarding.js";
import type * as onboarding_admin from "../onboarding/admin.js";
import type * as onboarding_analysis from "../onboarding/analysis.js";
import type * as onboarding_apps from "../onboarding/apps.js";
import type * as onboarding_codes from "../onboarding/codes.js";
import type * as onboarding_connect from "../onboarding/connect.js";
import type * as onboarding_normalize from "../onboarding/normalize.js";
import type * as onboarding_oauthState from "../onboarding/oauthState.js";
import type * as onboarding_signIn from "../onboarding/signIn.js";
import type * as onboarding_snapshot from "../onboarding/snapshot.js";
import type * as onboarding_tokens from "../onboarding/tokens.js";
import type * as plans from "../plans.js";
import type * as plans_hooks from "../plans/hooks.js";
import type * as plans_model from "../plans/model.js";
import type * as plans_reconcile from "../plans/reconcile.js";
import type * as plans_release from "../plans/release.js";
import type * as plans_retime from "../plans/retime.js";
import type * as plans_viewer from "../plans/viewer.js";
import type * as schools from "../schools.js";
import type * as seed from "../seed.js";
import type * as services_apify from "../services/apify.js";
import type * as services_claude from "../services/claude.js";
import type * as services_geocode from "../services/geocode.js";
import type * as services_resend from "../services/resend.js";
import type * as services_spotify from "../services/spotify.js";
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
  "admin/demo": typeof admin_demo;
  "admin/events": typeof admin_events;
  "admin/matching": typeof admin_matching;
  "admin/queue": typeof admin_queue;
  "admin/students": typeof admin_students;
  "ai/hooks": typeof ai_hooks;
  "ai/labels": typeof ai_labels;
  "ai/taste": typeof ai_taste;
  "asks/close": typeof asks_close;
  "asks/picker": typeof asks_picker;
  "asks/rules": typeof asks_rules;
  auth: typeof auth;
  contacts: typeof contacts;
  crons: typeof crons;
  "demo/admin": typeof demo_admin;
  "demo/behavior": typeof demo_behavior;
  "demo/fixtures": typeof demo_fixtures;
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
  "lib/normalize": typeof lib_normalize;
  "lib/pools": typeof lib_pools;
  "lib/registered": typeof lib_registered;
  "lib/validators": typeof lib_validators;
  "lib/views": typeof lib_views;
  "matching/admin": typeof matching_admin;
  "matching/blossom": typeof matching_blossom;
  "matching/config": typeof matching_config;
  "matching/names": typeof matching_names;
  "matching/run": typeof matching_run;
  "matching/taste": typeof matching_taste;
  "matching/wake": typeof matching_wake;
  me: typeof me;
  onboarding: typeof onboarding;
  "onboarding/admin": typeof onboarding_admin;
  "onboarding/analysis": typeof onboarding_analysis;
  "onboarding/apps": typeof onboarding_apps;
  "onboarding/codes": typeof onboarding_codes;
  "onboarding/connect": typeof onboarding_connect;
  "onboarding/normalize": typeof onboarding_normalize;
  "onboarding/oauthState": typeof onboarding_oauthState;
  "onboarding/signIn": typeof onboarding_signIn;
  "onboarding/snapshot": typeof onboarding_snapshot;
  "onboarding/tokens": typeof onboarding_tokens;
  plans: typeof plans;
  "plans/hooks": typeof plans_hooks;
  "plans/model": typeof plans_model;
  "plans/reconcile": typeof plans_reconcile;
  "plans/release": typeof plans_release;
  "plans/retime": typeof plans_retime;
  "plans/viewer": typeof plans_viewer;
  schools: typeof schools;
  seed: typeof seed;
  "services/apify": typeof services_apify;
  "services/claude": typeof services_claude;
  "services/geocode": typeof services_geocode;
  "services/resend": typeof services_resend;
  "services/spotify": typeof services_spotify;
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
