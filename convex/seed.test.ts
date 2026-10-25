/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

test("seeding is idempotent and only UC Berkeley is open", async () => {
  const t = convexTest(schema, modules);
  const first = await t.mutation(internal.seed.run, {});
  expect(first).toEqual({ schools: 3, spots: 4 });
  const second = await t.mutation(internal.seed.run, {});
  expect(second).toEqual({ schools: 0, spots: 0 });

  const schools = await t.query(api.schools.list, {});
  expect(schools.map((school) => [school.name, school.status])).toEqual([
    ["UC Berkeley", "open"],
    ["Stanford", "soon"],
    ["UCLA", "soon"],
  ]);
});

test("another spot sharing a seeded spot's name neither breaks the seed nor gets moved by it", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.run, {});
  // A team override for a venue across campus, named like the seeded spot.
  const overrideId = await t.run((ctx) =>
    ctx.db.insert("meetingSpots", {
      name: "Sather Gate",
      howToFind: "The side entrance by Zellerbach Hall.",
      lat: 37.8689,
      lng: -122.2608,
      directionsUrl: "https://www.openstreetmap.org/",
      area: "campus",
      chosenBy: "team",
    }),
  );
  expect(await t.mutation(internal.seed.run, {})).toEqual({ schools: 0, spots: 0 });
  const override = await t.run((ctx) => ctx.db.get(overrideId));
  expect(override).toMatchObject({ howToFind: "The side entrance by Zellerbach Hall.", lat: 37.8689 });
});

test("signed-out visitors get no profile", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.me.get, {})).toBeNull();
  expect(await t.query(api.admin.whoami, {})).toEqual({ signedIn: false, isAdmin: false, email: null });
});
