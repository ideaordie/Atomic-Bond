import { expect, it } from "vitest";
import { reviewFrame } from "../../src/prototypes/doodle/review-frame";
import { DoodleEditor, hasDot } from "../../src/prototypes/doodle/model";

it("moderation stepping exposes every intermediate point including erased content", () => {
  const editor = new DoodleEditor();
  editor.begin(0, true);
  editor.move(63);
  editor.finish();
  editor.begin(0, false);
  editor.move(31);
  editor.finish();
  const drawing = editor.export();
  for (let i = 0; i <= 64; i++) {
    const bits = reviewFrame(drawing, i);
    for (let p = 0; p < 64; p++) expect(hasDot(bits, p)).toBe(p < i);
  }
  for (let i = 65; i <= 96; i++) {
    const bits = reviewFrame(drawing, i);
    for (let p = 0; p < 64; p++) expect(hasDot(bits, p)).toBe(p >= i - 64);
  }
  expect(reviewFrame(drawing, 96)).toEqual(editor.bits);
});
