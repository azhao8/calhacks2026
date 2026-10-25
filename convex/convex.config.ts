import { defineApp } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config.js";

const app = defineApp();

// Outside calls run through pools so failures retry with backoff and bursts stay capped (§8.3).
app.use(workpool, { name: "aiPool" }); // Claude and Voyage
app.use(workpool, { name: "emailPool" }); // Resend
app.use(workpool, { name: "syncPool" }); // Spotify fetches and Apify imports

export default app;
