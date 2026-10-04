"use client";

import { logout } from "@/app/actions/auth";
import { forgetPushHere } from "@/lib/push-client";

/**
 * Logging out, which also takes this device off the account's notifications.
 *
 * The rest of what a browser keeps of a household is forgotten on the login page it lands
 * on (`ForgetOfflineData`), but a push subscription cannot be: it belongs to the account on
 * the server, and by then there is no session left to say whose it was. So it goes here,
 * on the press, while there still is.
 */
export function LogoutButton({ label }: { label: string }) {
  return (
    <form
      action={async () => {
        await forgetPushHere();
        await logout();
      }}
    >
      <button className="press-button rounded-lg text-slate-500 hover:text-slate-900">{label}</button>
    </form>
  );
}
