import { redirect } from 'next/navigation';
import { CampaignPage } from '@/components/campaigns/CampaignPage';

export default async function Page({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (brand !== 'bebeplay' && brand !== 'hosttail') redirect('/leads');
  // key: เปลี่ยนแบรนด์ = เข้าหน้าใหม่ (ถังโหลดใหม่ทุกครั้งที่เข้าหน้า เหมือน prototype)
  return <CampaignPage key={brand} brand={brand} />;
}
