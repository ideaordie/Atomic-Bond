import { NetworkPage } from "../../components/auth/NetworkPage";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ atom?: string }>;
}) {
  const { atom } = await searchParams;
  return <NetworkPage requested={atom} publicView={Boolean(atom)} />;
}
