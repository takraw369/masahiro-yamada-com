# Publishing Flow validation checklist

## Automated

- [ ] required CI `test-and-build`
- [ ] required CI `secret-scan`

## Real-use / Human Gate

- [ ] `/dashboard` shows Publishing Flow as first output decision surface
- [ ] `/dashboard/content-flow` restores old Content Flow local state where possible
- [ ] Phase selection updates Current Command and CTA guidance
- [ ] WHAT / audience / channel / CTA survive reload through local overlay
- [ ] Material Inbox still works
- [ ] Result / Learning notes still work locally and link to DISTRIBUTION_OS canonical
- [ ] Content Schedule opens from WHEN
- [ ] X Post receives Publishing Flow handoff
- [ ] “この骨格をComposerへ” inserts only a draft scaffold; it does not publish
- [ ] Mobile layout is usable

## Safety

- Drive remains canonical
- Dashboard local state remains overlay
- no public publish without Human Gate
- no new credentials, DB migration, scheduler, account, or external paid dependency
