import type {
  DefaultFunctionArgs,
  FunctionVisibility,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
} from "convex/server";

// The return type of a registered Convex function, read from its own definition rather than through the
// generated `internal` api. A thin wrapper annotated with it avoids the circular type you get when a
// handler's inferred return type depends on `ctx.runQuery(internal...)` in a module `internal` includes.
export type ReturnsOf<F> =
  F extends RegisteredQuery<FunctionVisibility, DefaultFunctionArgs, infer R>
    ? Awaited<R>
    : F extends RegisteredMutation<FunctionVisibility, DefaultFunctionArgs, infer R>
      ? Awaited<R>
      : F extends RegisteredAction<FunctionVisibility, DefaultFunctionArgs, infer R>
        ? Awaited<R>
        : never;
