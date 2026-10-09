# Mobile Capture Bridge — existing Playground / Issue #216

This patch opens the existing capture form from an iPhone share and uses its existing POST `/api/dashboard/intelligence`. No save occurs on opening the link. Saving still requires an authenticated Dashboard session and a deliberate tap. RELEASE creates existing review drafts; it does not publish or write Drive canonical content.

## Input contract

- Existing route: `https://masahiroyamada.com/dashboard/playground`
- Explicit trigger: `capture=1`
- Optional `url` (HTTP(S), no embedded credentials, max 2048), `title` (240), `text` (4000).
- Prefer fragment input: `/dashboard/playground#capture=1&url=ENCODED_URL&title=ENCODED_TITLE&text=ENCODED_TEXT`. Fragments are not sent in HTTP requests. Query input is supported for compatibility but must not carry private notes or signed links.
- URL-encode each value separately. Do not encode the whole combined parameter string. No password, key, account token, or customer identity belongs in a Shortcut.
- The form defaults URL shares to Source; text-only shares to Insight. Title defaults to host or first text line. Values remain editable. Oversized inputs show a warning. Consumed parameters are removed from the current history entry.

## iPhone Shortcut recipe

1. Create a Shortcut named `MASAへ共有`. Enable Show in Share Sheet; accept URLs and text.
2. Read the first shared URL, or shared text. Optional title may be empty. For voice, use iOS dictation to provide text to the same Shortcut. For a screenshot, use Extract Text from Image and send that text; image bytes are not uploaded by this patch.
3. Apply URL Encode separately to each supplied field. Keep text brief (up to 1500 characters for reliable app handoff; component accepts 4000). Create Text with the fragment URL above. Open URLs.
4. Review the populated form and tap PRIVATE FEEDへ. Topic/reason are optional edits.

Login must already be active in the browser opening the Shortcut. The existing login redirect does not preserve share input. If expired, log in and repeat the share from the source; do not weaken auth or put credentials into the Shortcut. Actual iPhone Share Sheet / Safari login and save are release checks, not proven by unit tests.

## Source processing seam

Capture is a private signal, not a completed transcription or canonical asset. YouTube PR #166 in masa-automation remains the collector implementation to revalidate on latest main, with flags off and a single-source dedupe canary before activation. Knowledge Engine PR #173 is a policy/Skill extension and is not a replacement runtime. Generic Web/X and OCR/audio results can be processed by Work using existing source capture / media ingest and canonical review; never invent missing source text.

## Release verification

Test plain visit, fragment and query share, Japanese/ampersands/newlines, unsafe URLs, long input, save error preservation, duplicate-click prevention, mobile layout, authenticated save and unauthenticated redirect. No production save, deployment, automatic post, LINE delivery, new API, schema, or credential change is authorized by this patch.
