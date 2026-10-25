"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/app/_lib/routes";

// The demo phone: on a laptop or projector the app sits inside an iPhone with its Dynamic Island,
// so the stage demo shows Melos at the size it's built for. On a phone, and on the team's admin
// page, the wrappers have no box (display: contents) and nothing changes. The tree is the same
// either way, so moving between admin and the app never remounts it. Styles: device-frame.css.
export function DeviceFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const on = !pathname.startsWith(ROUTES.admin);
  return (
    <div data-frame={on ? "on" : "off"} className="device-stage">
      <div className="device-phone">
        <div className="device-screen">
          <div className="device-scroll">{children}</div>
        </div>
        <div aria-hidden="true" className="device-island" />
      </div>
    </div>
  );
}
