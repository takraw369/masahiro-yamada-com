# MASA Voice Commander — iPhone MVP (pilot)

## Purpose
Unify iPhone voice-based accessibility control with the existing MASA Agent OS voice assistant, without a second Agent OS, database, runner, or task source of truth.

Primary route: WRAP / UPDATE existing Dashboard, not BUILD a standalone product.

## Actual delivered scope
- Authenticated /dashboard/voice-commander under the existing Dashboard session middleware.
- User-initiated speech recognition where supported; iPhone keyboard dictation as fallback.
- Local deterministic command classification (no LLM authority).
- Read-only NOW/NEXT/REVIEW tasks from existing /api/dashboard/task-execution, plus a separately labeled Google Calendar snapshot from the existing /api/dashboard/calendar with latest sync timestamp.
- Existing /api/dashboard/knowledge-ask for questions, opt-in speech synthesis.
- Preview and explicit confirmation before writing spoken note to private Knowledge via /api/dashboard/knowledge.
- Explicit link confirmation before navigating existing Dashboard pages.
- Blocking irreversible voice commands: posting, sending, deletion, payment, deployment, merge.
- No voice transcripts persisted in localStorage, URL/query, Git or new database.
- Existing Dashboard navigation and App Library entry.

## iPhone setup (manual configuration; not shipped by the web app)
1. Settings → Accessibility → Voice Control. Download Japanese language files if prompted.
2. Confirm OS commands like scrolling and tapping work. MASA Voice Commander does not directly control iOS.
3. In Shortcuts, create a shortcut with Open URLs, targeting the human-approved deployed URL ending in /dashboard/voice-commander. Name it MASA起動. Trigger with Siri by name. Never embed private transcription or credentials in URL.
4. Optionally Voice Control → Customize Commands → Create New Command → Run Shortcut → MASA起動.
5. Authenticate to Dashboard in Safari. Add to iPhone Home Screen if desired.

Apple documentation:
https://support.apple.com/ja-jp/118275
https://support.apple.com/ja-jp/guide/iphone/iph2c21a3c88/ios
https://developer.apple.com/documentation/AppIntents

## Canonical and security boundaries
- MASA_TASK_BOARD/TASKS remains canonical for tasks. Voice pilot does NOT write task state.
- Knowledge capture writes to existing private Knowledge staging only. It is NOT Drive canonical assetization.
- Existing src/middleware.ts controls sessions and same-origin access.
- Save only after the user's explicit second button press; report success only after response.
- Model output is displayed via textContent and never executed.
- Browser speech services may process recognized speech; user must trigger microphone intentionally.
- No background microphone, wake word, user voice cloning, external communication, payment or deploy.
- Do not log transcripts, embed tokens in Shortcuts or add external telemetry.

## Verification
- node --test tests/voice-commander.test.mjs
- npm test
- npm run typecheck:release
- npm run build
- npm run security:check
- iPhone Safari sign-in, mic permission and keyboard dictation fallback, answer readout
- Task readback: check no calendar event claims
- Knowledge readback: one explicit capture; confirm saved exactly once
- Unsafe voice commands: confirm no mutation network call
- Siri/Voice Control shortcut invocation after authorized deployment
- Console and network privacy inspection

## Human Gate
Draft PR only. No merge, production deploy, App Store publishing, Supabase migration, social posts or external messages. Real device smoke, privacy review and human approval precede release.

## Later (not MVP)
Optional native SwiftUI adapter with App Intents / Shortcuts and explicit push-to-talk; Apple's Voice Control remains the independent OS gesture layer.
