import { NetworkPage } from "../../../components/auth/NetworkPage";

export default async function PublicAtomPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <NetworkPage requested={publicId} publicView />;
}
