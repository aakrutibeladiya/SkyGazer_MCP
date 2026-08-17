export function phaseName(age: number): string {
  const cycle = 29.53;
  const t = ((age % cycle) + cycle) % cycle;
  const eighth = cycle / 16;
  if (t < eighth * 1) return "New Moon";
  if (t < eighth * 3) return "Waxing Crescent";
  if (t < eighth * 5) return "First Quarter";
  if (t < eighth * 7) return "Waxing Gibbous";
  if (t < eighth * 9) return "Full Moon";
  if (t < eighth * 11) return "Waning Gibbous";
  if (t < eighth * 13) return "Last Quarter";
  if (t < eighth * 15) return "Waning Crescent";
  return "New Moon";
}

export function moonStargazingNote(illuminationPercent: number): string {
  if (illuminationPercent < 10) {
    return "Excellent for stargazing — near-new moon, dark skies for faint deep-sky objects.";
  }
  if (illuminationPercent < 40) {
    return "Good for stargazing — the moon is dim enough for most deep-sky viewing.";
  }
  if (illuminationPercent < 70) {
    return "Fair for stargazing — moonlight will wash out fainter objects, but bright targets (planets, star clusters) are still worth it.";
  }
  return "Not ideal for faint deep-sky objects — the moon is bright enough to wash them out, but it's a great night to look at the Moon itself.";
}
