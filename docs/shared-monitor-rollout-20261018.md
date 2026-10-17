# MASA OS Shared Monitor — Mac / Web / iPhone

Status: Draft PR / not yet on production until reviewed and merged.

## Single source of truth

- Production canonical: https://masahiroyamada.com/dashboard
- Shared read-only surface: /dashboard/monitor
- Compact desktop surface: /dashboard/monitor?compact=1
- No new source of truth or duplicated storage. Task state is read from the existing authenticated Supabase task execution API. First-product status is read from the existing shared FLOW Board API. Drive remains the knowledge/policy canonical.
- Uses the existing dashboard login cookie/session and same-origin API rules. Each device must sign in independently. The session expires after 24 hours of inactivity.
- The monitor performs GET requests only. It does not approve, publish, pay, change tasks, or change FLOW Board state.
- Visible tabs re-check every 60 seconds, on focus, on returning from background, and manually. This is **polling**, not push real-time and not guaranteed to reflect changes when offline. Both API requests explicitly use no-store.
- If one source cannot be retrieved, that portion is marked unverified instead of showing synthetic/old data. Task cards display up to 300 task records; if the limit is reached, counts represent the returned range.
- First Product shows workflow stage / registration evidence, **not** a live sales amount.

## After release — installing on Mac

Open https://masahiroyamada.com/dashboard/monitor in an installed-web-app-capable browser. Use the browser's Install app / Create shortcut as app (menu wording varies), then launch MONITOR as a separate window. To remove the Dashboard's sidebar and topbar for a compact desktop display, visit https://masahiroyamada.com/dashboard/monitor?compact=1. Add the installed app to macOS Login Items if you want it to launch after sign-in.

This is an installed PWA window, not an always-on-top overlay. Keep-above-all-windows, menu bar integration and native desktop notifications require a separately reviewed lightweight native wrapper such as Tauri; do not claim those exist now.

## After release — installing on iPhone

Open https://masahiroyamada.com/dashboard/monitor in Safari, sign in, then Share > Add to Home Screen. Use the installed MONITOR icon. iPhone requires its own authenticated session. If prompted to log in again after inactivity, do so. Test Safari rendering, Add to Home Screen behavior, session renewal and resume from background on a real device.

## Human Gate before production

- CI: node tests, typecheck, Astro build, preview smoke, security checks.
- Manually validate authenticated read of task execution and FLOW Board, including one-source failure and session timeout.
- Verify that server-generated private responses keep private headers, and no service-worker caching of private routes is introduced.
- Test phone widths and Safari Add to Home Screen as well as Mac browser install.
- PR review and explicit release gate; feature branch pushes alone do not deploy master.

## Later follow-on, separate review

- Native Mac mini window pinning / always-on-top / menu bar via Tauri.
- If requested, a push-update transport with independent auth checks. Keep polling until verified and avoid unnecessary realtime infrastructure.
