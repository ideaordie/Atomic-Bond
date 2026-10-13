import { notFound } from "next/navigation";
import { PuzzleStudio } from "../../../../components/puzzle/PuzzleStudio";
export default function StudioReview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <PuzzleStudio
      initial={{
        now: "2026-10-13T12:00:00Z",
        gates: { public: false, controlled: false },
        total: 1,
        cleanup: {
          lastSuccess: "2026-10-13T12:00:00Z",
          lastFailure: null,
          ok: true,
          counts: { media: 0 },
        },
        batches: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            createdAt: "2026-10-13T12:00:00Z",
            expiresAt: "2026-10-14T12:00:00Z",
            ready: true,
            mediaCount: 27,
            puzzle: null,
          },
        ],
      }}
    />
  );
}
