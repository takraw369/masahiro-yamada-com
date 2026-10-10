# LEARN.md — Actionable Learning Only

This is not a diary or session log.
Store only feedback that must change future implementation behavior.

## Entry format

### YYYY-MM-DD — short label
- Corrected: what MASA made us change
- Cause: why the first implementation missed
- Rule: what must be done differently next time

## Promotion rule

When the same class of learning appears twice:

1. Promote it to `CLAUDE.md`, `CHECKLIST.md`, `DESIGN.md`, or the relevant canonical code/doc.
2. Keep only the minimum historical note here if it still adds value.
3. Do not let this file become a second rulebook.

## Current learnings

### 2026-10-07 — Otsu4 identification handoff order
- Corrected: 鑑別項目を一度に全部出さず、講習で渡された順を保持して段階解放する。既存項目は重複追加せず同じ正本配列へ統合する。
- Cause: 弱点優先ランダムだけでは、講習側が指定した導入順と認知負荷を守れない。
- Rule: Otsu4鑑別の新規教材は teacher handoff order を canonical sequence とし、初回は小さなprefixだけを出す。○が安定したら後続を小分けに解放し、×/△の再出題だけ順序を上書きしてよい。


### 2026-09-21 — Dashboard narrow-desktop width
- Corrected: `/dashboard` で固定サイドバーを残したまま狭いデスクトップ幅に入ると、Cockpitカードが横にはみ出して表示が崩れた。
- Cause: レスポンシブ判定をviewport幅だけで考え、220pxの固定サイドバーを差し引いた実際の本文幅を十分に確保していなかった。
- Rule: Dashboard系UIは「viewport幅」ではなく「sidebar + content paddingを差し引いた本文の実効幅」で判断する。狭いデスクトップではsidebarを早めにdrawer化し、横スクロールを発生させない。

### 2026-09-18 — Material creation human gate
- Corrected: MASAに教材をゼロから作らせず、AIが既存知識から初稿と編集候補を先に作り、MASAは本人の言葉・実例・判断が必要な箇所だけ編集して承認する。
- Cause: 「完成教材をINBOXへ入れる」を人間の作業に残すと、生成能力があるのに制作の最重工程がMASAへ戻ってしまう。
- Rule: 教材化は `Canonical / CONTENT_OS → AI Draft → MASA REVIEW → Human approval → ACE_ASSET_INBOX` を標準フローにする。AIはLive公開を自動化せず、本人性と公開判断はHuman Gateに残す。

### 2026-09-17 — Production automation boundary
- Corrected: ACEのDrive監視をChatGPTのスケジュールタスクで本番運用しない。Drive / Google側の自動化と常設バックエンドで動かす。
- Cause: 会話内タスクは通知・定期確認には向くが、商品ランタイムの永続的な取り込み基盤にするとChatGPTの実行環境へ運用依存してしまう。
- Rule: 本番の監視・取り込み・同期はDrive / Apps Script / Cloudflare / Supabaseなどの常設システムに置く。ChatGPTのタスクは本番ランタイムの代替にしない。

### 2026-09-13 — Quest follow-up pressure
- Corrected: Questの未実行フォローで、同じ催促や強いプッシュを日ごとに繰り返さない。未実行が続くほど切り口と頻度を変える。
- Cause: 完了率だけを最適化すると、コーチングが「戻りやすい場」ではなく追い立てる通知になり、離脱や嫌悪につながる。
- Rule: 未実行フォローは原則として「許可・最小化 → 選択・主体性 → 再解釈 → 自律・クールダウン」と角度を変え、反応がなければ頻度を落とす。罪悪感、連続記録喪失の恐怖、同文連投で行動を迫らない。

### 2026-09-08 — Source-of-truth mismatch
- Corrected: treat executable project configuration as authoritative when repository documentation claims a different framework/runtime state.
- Cause: documentation can remain correct in spirit while technical version details become stale.
- Rule: before acting on framework, deploy, domain, storage, or runtime claims in docs, verify them against current executable config and fix confirmed stale docs.

### 2026-10-07 — Mobile visual quality before style fidelity
- Corrected: Floating Showroom初版はiPhoneで構図が崩れ、CSSの簡易衣服・黒金の重い配色も含めて「陳腐で魅力を感じない」と判定された。参考表現の構造を守ることより、モバイル上で作品として魅力が立つことを優先する。
- Cause: Desktopのrack構造を縮小してMobileへ流用し、prototypeであることを理由にObject fidelityを落とした。また既存のblack/gold tokenをReferenceのsoft/editorialな感情より優先した。
- Rule: Public-facing / visual-labの表現はMobile Firstで別構図として設計し、Human Gate前に①iPhone 3秒感情 ②object/material fidelity ③next-item affordance ④type/whitespace ratioを確認する。既存Brand tokenは目的・Referenceの感情を壊す場合に実験Surfaceへ強制しない。簡易CSS図形をHero Objectとして使わない。

