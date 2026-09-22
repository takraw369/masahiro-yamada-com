import { otsu6Questions } from '../data/otsu6Questions';

// The authored bank keeps the correct fact in slot 0 for reviewability.
// Rotate choices deterministically at runtime so the study UI cannot be gamed
// by learning a fixed answer position. The same question remains stable across
// reloads, which keeps review less distracting on a phone.
for (const question of otsu6Questions) {
  const hash = [...question.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const shift = hash % 4;
  if (shift === 0) continue;

  const original = [...question.choices];
  question.choices = [
    original[shift % 4],
    original[(shift + 1) % 4],
    original[(shift + 2) % 4],
    original[(shift + 3) % 4],
  ] as typeof question.choices;
  question.answer = ((question.answer - shift + 4) % 4) as typeof question.answer;
}
