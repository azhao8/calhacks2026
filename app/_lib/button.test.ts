import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Button } from "../../components/Button";

const render = (props: Parameters<typeof Button>[0]) => renderToStaticMarkup(createElement(Button, props, "Continue"));

test("a loading submit button is natively disabled, so its form can't submit twice", () => {
  const html = render({ type: "submit", loading: true });
  expect(html).toMatch(/\sdisabled=""/);
  expect(html).toContain('aria-busy="true"');
  // The label stays, so the width holds.
  expect(html).toContain("Continue");
});

test("an explicit disabled state is kept, and an idle button is enabled", () => {
  expect(render({ disabled: true })).toMatch(/\sdisabled=""/);
  expect(render({})).not.toMatch(/\sdisabled=""/);
});
