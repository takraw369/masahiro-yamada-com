import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { motionPresets, makeMotionRequest } from '../src/data/motionPresetCatalog.ts';

test('Motion Picker catalog uses unique IDs and bounded independent presets', () => {
  assert.equal(motionPresets.length, 12);
  assert.equal(new Set(motionPresets.map(item => item.id)).size, motionPresets.length);
  for (const motion of motionPresets) {
    assert.ok(motion.duration >= 150 && motion.duration <= 1500);
    assert.ok(motion.purpose.length > 0);
    assert.ok(motion.guidance.length > 0);
  }
});

test('AI implementation brief retains target, concrete motion, safety, and review gates', () => {
  const request = makeMotionRequest(motionPresets[0], '/otsu4', '正解の結果表示');
  assert.match(request, /\/otsu4/);
  assert.match(request, /正解の結果表示/);
  assert.match(request, /quiet-fade/);
  assert.match(request, /prefers-reduced-motion/);
  assert.match(request, /Preview/);
  assert.match(request, /Human Gate/);
  assert.match(request, /無断で実施しない/);
});

test('Motion Picker is routed from the canonical Design Studio without auto-send', () => {
  const page = readFileSync(new URL('../src/pages/dashboard/motion-picker.astro', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../src/pages/dashboard/design-templates.astro', import.meta.url), 'utf8');
  const picker = readFileSync(new URL('../src/components/dashboard/MotionPicker.tsx', import.meta.url), 'utf8');
  assert.match(page, /DashboardLayout/);
  assert.match(page, /client:load/);
  assert.match(studio, /\/dashboard\/motion-picker/);
  assert.match(picker, /makeMotionRequest/);
  assert.match(picker, /navigator\.clipboard\.writeText/);
  assert.match(page, /prefers-reduced-motion/);
  assert.doesNotMatch(picker, /fetch\(|window\.location\.assign\(/);
});
