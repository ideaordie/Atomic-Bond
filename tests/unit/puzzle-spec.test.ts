import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
it("v0.5 preserves frozen v0.4 and adds only the exact approved Section 48B", () => {
  const old = readFileSync("docs/MASTER_SPEC_v0.4.md", "utf8");
  const next = readFileSync("docs/MASTER_SPEC_v0.5.md", "utf8");
  const proposal = readFileSync(
    "docs/proposals/TASK_13_0_PARTICI_PUZZLE.md",
    "utf8",
  );
  const approved = proposal
    .slice(
      proposal.indexOf("## 48B."),
      proposal.indexOf("\n---", proposal.indexOf("## 48B.")),
    )
    .trim();
  expect(
    next
      .replace(approved + "\n\n---\n\n", "")
      .replace("Specification --- v0.5", "Specification --- v0.4")
      .replace(
        "**Supersedes:** Master Product Specification v0.4",
        "**Supersedes:** Master Product Specification v0.3",
      ),
  ).toBe(old);
});
