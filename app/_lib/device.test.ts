import { expect, test } from "vitest";
import { parseDeviceSchool } from "./device";

test("parseDeviceSchool reads only what we wrote", () => {
  expect(parseDeviceSchool(JSON.stringify({ id: "abc", themeId: "berkeley" }))).toEqual({ id: "abc", themeId: "berkeley" });
  expect(parseDeviceSchool(null)).toBeNull();
  expect(parseDeviceSchool("not json")).toBeNull();
  expect(parseDeviceSchool(JSON.stringify({ id: 1, themeId: "berkeley" }))).toBeNull();
  expect(parseDeviceSchool(JSON.stringify({ id: "abc" }))).toBeNull();
});
