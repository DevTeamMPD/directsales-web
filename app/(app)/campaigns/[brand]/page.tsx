import { redirect } from 'next/navigation';
import { Placeholder } from '@/components/shell/Placeholder';

export default async function CampaignPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (brand !== 'bebeplay' && brand !== 'hosttail') redirect('/leads');
  return <Placeholder plan="B" />;
}
