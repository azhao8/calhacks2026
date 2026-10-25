import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { apifyWebhook } from "./events/webhook";

const http = httpRouter();

auth.addHttpRoutes(http);

// Apify calls this when an event scout run succeeds (§6.1); the handler checks the shared secret.
http.route({ path: "/apify/webhook", method: "POST", handler: apifyWebhook });

export default http;
