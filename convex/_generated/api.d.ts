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
import type * as ai_labels from "../ai/labels.js";
import type * as ai_taste from "../ai/taste.js";
import type * as auth from "../auth.js";
import type * as contacts from "../contacts.js";
import type * as help from "../help.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_clock from "../lib/clock.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_edu from "../lib/edu.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_format from "../lib/format.js";
import type * as lib_pools from "../lib/pools.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_views from "../lib/views.js";
import type * as me from "../me.js";
import type * as onboarding from "../onboarding.js";
import type * as onboarding_admin from "../onboarding/admin.js";
import type * as onboarding_analysis from "../onboarding/analysis.js";
import type * as onboarding_apps from "../onboarding/apps.js";
import type * as onboarding_connect from "../onboarding/connect.js";
import type * as onboarding_guard from "../onboarding/guard.js";
import type * as onboarding_normalize from "../onboarding/normalize.js";
import type * as onboarding_oauthState from "../onboarding/oauthState.js";
import type * as onboarding_pools from "../onboarding/pools.js";
import type * as onboarding_signIn from "../onboarding/signIn.js";
import type * as onboarding_snapshot from "../onboarding/snapshot.js";
import type * as onboarding_tokens from "../onboarding/tokens.js";
import type * as plans from "../plans.js";
import type * as schools from "../schools.js";
import type * as seed from "../seed.js";
import type * as services_claude from "../services/claude.js";
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
  "ai/labels": typeof ai_labels;
  "ai/taste": typeof ai_taste;
  auth: typeof auth;
  contacts: typeof contacts;
  help: typeof help;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/clock": typeof lib_clock;
  "lib/config": typeof lib_config;
  "lib/edu": typeof lib_edu;
  "lib/errors": typeof lib_errors;
  "lib/format": typeof lib_format;
  "lib/pools": typeof lib_pools;
  "lib/validators": typeof lib_validators;
  "lib/views": typeof lib_views;
  me: typeof me;
  onboarding: typeof onboarding;
  "onboarding/admin": typeof onboarding_admin;
  "onboarding/analysis": typeof onboarding_analysis;
  "onboarding/apps": typeof onboarding_apps;
  "onboarding/connect": typeof onboarding_connect;
  "onboarding/guard": typeof onboarding_guard;
  "onboarding/normalize": typeof onboarding_normalize;
  "onboarding/oauthState": typeof onboarding_oauthState;
  "onboarding/pools": typeof onboarding_pools;
  "onboarding/signIn": typeof onboarding_signIn;
  "onboarding/snapshot": typeof onboarding_snapshot;
  "onboarding/tokens": typeof onboarding_tokens;
  plans: typeof plans;
  schools: typeof schools;
  seed: typeof seed;
  "services/claude": typeof services_claude;
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
