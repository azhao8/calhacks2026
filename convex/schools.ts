import { query } from "./_generated/server";
import { v } from "convex/values";
import { vSchoolView } from "./lib/views";

// S02: the school picker. Public; only display fields.
export const list = query({
  args: {},
  returns: v.array(vSchoolView),
  handler: async (ctx) => {
    const schools = await ctx.db.query("universities").collect();
    return schools
      .map(({ _id, name, city, colors, status, themeId }) => ({ _id, name, city, colors, status, themeId }))
      .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "open" ? -1 : 1));
  },
});
