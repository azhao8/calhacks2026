// A fake Convex deployment for Playwright: it answers the browser's sync WebSocket the way the real
// server would, from a scenario's fixture data. No network, no sign-in, no real deployment.
//
// What it speaks (convex/dist/esm/browser/sync/protocol.js):
//   client → Connect, ModifyQuerySet (Add / Remove), Mutation, Action, Authenticate, Event
//   server → Transition (QueryUpdated / QueryFailed), MutationResponse, ActionResponse
//
// A scenario's `data` maps a function path ("me:get", "plans:current") to one of:
//   a plain value            → the query returns it
//   MockConvex.hold          → the query never answers (loading state)
//   MockConvex.fail(code)    → the query fails with ConvexError({ code })
// Mutations and actions go through `handlers[path](args, mock)`; the default returns null after
// `mutationDelayMs`. A handler may call mock.set(path, value) to push a live update, as the real
// server would after a write.

const HOLD = Symbol("hold");

function u64(n) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(n));
  return bytes.toString("base64");
}

function fail(code, message) {
  return { __fail: true, code, message: message ?? code };
}

class MockConvex {
  constructor({ data = {}, handlers = {}, mutationDelayMs = 150 } = {}) {
    this.data = { ...data };
    this.handlers = handlers;
    this.mutationDelayMs = mutationDelayMs;
    this.calls = []; // every mutation and action, for assertions (double taps, args)
    this.sockets = new Set();
  }

  // Wire into a Playwright page or context. Every Convex sync socket is answered here.
  async attach(target) {
    await target.routeWebSocket(/\/api\/[^/]+\/sync$/, (ws) => this.#serve(ws));
  }

  set(path, value) {
    this.data[path] = value;
    for (const s of this.sockets) s.push([path]);
  }

  #serve(ws) {
    const queries = new Map(); // queryId → udfPath
    const version = { querySet: 0, identity: 0, ts: 0 };
    const send = (msg) => ws.send(JSON.stringify(msg));

    const modification = (queryId, path) => {
      const value = path in this.data ? this.data[path] : null;
      if (value === HOLD) return null;
      if (value && value.__fail) {
        return {
          type: "QueryFailed",
          queryId,
          errorMessage: value.message,
          errorData: { code: value.code, message: value.message },
          logLines: [],
          journal: null,
        };
      }
      return { type: "QueryUpdated", queryId, value: value === undefined ? null : value, logLines: [], journal: null };
    };

    const transition = (nextQuerySet, mods, nextIdentity = version.identity) => {
      const start = { querySet: version.querySet, identity: version.identity, ts: u64(version.ts) };
      version.ts += 1;
      version.querySet = nextQuerySet;
      version.identity = nextIdentity;
      const end = { querySet: version.querySet, identity: version.identity, ts: u64(version.ts) };
      send({ type: "Transition", startVersion: start, endVersion: end, modifications: mods });
    };

    const socket = {
      push: (paths) => {
        const mods = [];
        for (const [id, path] of queries) {
          if (!paths.includes(path)) continue;
          const m = modification(id, path);
          if (m) mods.push(m);
        }
        transition(version.querySet, mods);
      },
    };
    this.sockets.add(socket);
    ws.onClose(() => this.sockets.delete(socket));

    ws.onMessage(async (raw) => {
      const msg = JSON.parse(String(raw));
      switch (msg.type) {
        case "ModifyQuerySet": {
          const mods = [];
          for (const m of msg.modifications) {
            if (m.type === "Add") {
              queries.set(m.queryId, m.udfPath);
              const mod = modification(m.queryId, m.udfPath);
              if (mod) mods.push(mod);
            } else if (m.type === "Remove") {
              queries.delete(m.queryId);
              mods.push({ type: "QueryRemoved", queryId: m.queryId });
            }
          }
          transition(msg.newVersion, mods);
          break;
        }
        case "Authenticate":
          transition(version.querySet, [], msg.baseVersion + 1);
          break;
        case "Mutation":
        case "Action": {
          const path = msg.udfPath;
          const args = msg.args?.[0] ?? {};
          this.calls.push({ type: msg.type, path, args, at: Date.now() });
          const handler = this.handlers[path];
          let result = null;
          let error = null;
          await new Promise((r) => setTimeout(r, this.mutationDelayMs));
          try {
            if (handler) result = (await handler(args, this)) ?? null;
          } catch (e) {
            error = e && e.__fail ? e : fail("retryable", String(e));
          }
          if (msg.type === "Action") {
            send(
              error
                ? { type: "ActionResponse", requestId: msg.requestId, success: false, result: error.message, errorData: { code: error.code, message: error.message }, logLines: [] }
                : { type: "ActionResponse", requestId: msg.requestId, success: true, result, logLines: [] },
            );
          } else if (error) {
            send({ type: "MutationResponse", requestId: msg.requestId, success: false, result: error.message, errorData: { code: error.code, message: error.message }, logLines: [] });
          } else {
            send({ type: "MutationResponse", requestId: msg.requestId, success: true, result, ts: u64(version.ts + 1), logLines: [] });
            transition(version.querySet, []); // the mutation resolves once the client sees its ts
          }
          break;
        }
        default:
          break; // Connect, Event: nothing to answer
      }
    });
  }
}

// Signs the browser in as far as Convex Auth's client can tell: a fake, unsigned JWT in the storage
// slot ConvexAuthProvider reads (`__convexAuthJWT_` + the deployment URL with symbols removed). The
// mock answers the resulting Authenticate message, so useConvexAuth() reports signed in.
MockConvex.signIn = async function signIn(context, deploymentUrl = "https://qa-mock.convex.cloud") {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const jwt = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ sub: "user_me|session", iat: now, exp: now + 86400 })}.qa`;
  const ns = deploymentUrl.replace(/[^a-zA-Z0-9]/g, "");
  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
    },
    [`__convexAuthJWT_${ns}`, jwt],
  );
};

MockConvex.hold = HOLD;
MockConvex.fail = fail;
module.exports = { MockConvex };
