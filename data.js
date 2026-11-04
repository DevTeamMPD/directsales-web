/* ข้อมูลตัวอย่างสำหรับ Preview เท่านั้น (ไม่ใช่ข้อมูลจริง) */
(function () {
  const reps = [
    { id: 'r1', name: 'อาทิตยา คชสร', initials: 'อค', role: 'sales' },
    { id: 'r2', name: 'กมลชนก ใจดี', initials: 'กจ', role: 'sales' },
    { id: 'r3', name: 'ปรีชา วงศ์ทอง', initials: 'ปว', role: 'sales' },
    { id: 'r4', name: 'Dev MPD', initials: 'DM', role: 'admin' },
  ];
  const campaigns = [
    { id: 'c-bebe-nov', brand: 'bebeplay', claimMode: 'self', name: 'Bebeplay · ลูกค้าเก่า 6 เดือน', start: '2026-11-01', end: '2026-11-30', note: 'โปรเตียงเด็กและแผ่นรองคลาน ลด 10% สำหรับลูกค้าเดิม' },
    { id: 'c-host-nov', brand: 'hosttail', claimMode: 'auto', name: 'Hosttail · ทาสแมวกลับมาซื้อ', start: '2026-11-01', end: '2026-11-30', note: 'ห้องน้ำแมวอัจฉริยะ + ทรายแมว แถมถุงขยะ' },
    { id: 'c-bebe-oct', brand: 'bebeplay', claimMode: 'assign', name: 'Bebeplay · Double Date 10.10', start: '2026-10-05', end: '2026-10-20', note: 'แคมเปญที่ปิดแล้ว' },
  ];
  const first = ['สุภาพร','วีรวัฒน์','นภัสสร','ธนากร','พิมพ์ชนก','ณัฐวุฒิ','ชลธิชา','อนุชา','กานต์ธิดา','ปิยะนุช','รัชนี','สมศักดิ์','ศิริพร','ภาคิน','จิราพร','เมธัส','อรอนงค์','พีรพัฒน์','ขวัญใจ','ธีรเดช'];
  const last = ['ใจดี','รุ่งเรือง','แสงทอง','สุขสวัสดิ์','มั่นคง','พงษ์ไทย','ศรีสุข','วัฒนา','เจริญผล','บุญมา'];
  const shops = ['Loo_bebeplay','SH_bebeplay','SH_hosttail','Line_OA','TikTok_bebeplay','Lazada_hosttail'];
  const products = [
    ['BBP-PLAY-01','แผ่นรองคลาน Playtime 180x200',790],
    ['BBP-BED-03','เตียงนอนไม้พับได้ รุ่น Little Home',3290],
    ['BBP-EVA-06','แผ่น EVA รองนอนสุขุม หนา 6 มม.',1190],
    ['BBP-FENCE','คอกกั้นเด็ก 8 ชิ้น',2490],
    ['HST-LITTER-2','ห้องน้ำแมวอัจฉริยะ รุ่น 2',4990],
    ['HST-MAT-01','แผ่นรองกันลื่นสัตว์เลี้ยง',390],
    ['HST-SAND-5','ทรายแมวเต้าหู้ 5 ลิตร',259],
  ];
  const statuses = ['new','following','callback','won','lost','unreachable'];
  const today = new Date('2026-11-04T09:00:00');
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  const leads = [];
  for (let i = 0; i < 28; i++) {
    const isHost = i % 3 === 2;
    const nPurch = 1 + Math.floor(rnd() * 3);
    const purchases = [];
    for (let k = 0; k < nPurch; k++) {
      const p = pick(products.filter(x => isHost ? x[0].startsWith('HST') : x[0].startsWith('BBP')));
      purchases.push({ date: addDays(-30 - Math.floor(rnd() * 400)), bill: String(100000 + Math.floor(rnd() * 899999)), seller: pick(reps).id, sku: p[0], product: p[1], amount: p[2] });
    }
    purchases.sort((a, b) => b.date.localeCompare(a.date));
    const status = i < 10 ? 'new' : pick(statuses);
    let owner = pick(reps).id;
    const fromCampaign = i % 5 !== 0;
    if (status === 'new' && fromCampaign && (i % 2 === 1 || i % 3 === 2)) owner = null; // ยังไม่มีผู้ดูแล (กองกลางแคมเปญ)
    const phone = '0' + pick(['81','86','89','92','95','64']) + String(1000000 + Math.floor(rnd() * 8999999));
    const interactions = [];
    const lastDay = addDays(-1 - Math.floor(rnd() * 75));
    if (status !== 'new') {
      interactions.push({ id: 'i' + i + 'a', type: i % 2 ? 'chat' : 'call', date: lastDay + 'T1' + (i % 10) + ':20', rep: owner || 'r4', result: status === 'unreachable' ? 'ไม่รับสาย' : 'คุยแล้ว', note: status === 'won' ? 'สนใจโปร ตกลงสั่งซื้อ' : status === 'lost' ? 'ยังไม่สะดวกซื้อ' : status === 'unreachable' ? 'โทรสองครั้งไม่รับ' : 'ขอดูโปรก่อน นัดคุยอีกครั้ง' });
    }
    leads.push({
      id: 'L' + (1000 + i),
      name: first[i % first.length] + ' ' + last[(i * 3) % last.length],
      phone,
      address: 'เขต' + pick(['บางนา','ลาดพร้าว','หนองจอก','เมืองเชียงใหม่','บางกรวย']) + ' ' + pick(['กรุงเทพฯ','เชียงใหม่','นนทบุรี']),
      shop: isHost ? pick(['SH_hosttail','Lazada_hosttail']) : pick(['Loo_bebeplay','SH_bebeplay','TikTok_bebeplay']),
      source: i % 5 === 0 ? 'self' : 'campaign',      // self = เซลล์ขุดเอง, campaign = ระบบตั้งให้
      brand: isHost ? 'hosttail' : 'bebeplay',
      campaignId: i % 5 === 0 ? null : (isHost ? 'c-host-nov' : (i % 7 === 0 ? 'c-bebe-oct' : 'c-bebe-nov')),
      owner,
      status,
      callback: status === 'callback' ? addDays(Math.floor(rnd() * 5) - 1) : null,
      purchases,
      interactions,
      interest: status === 'new' ? '' : pick(['เตียงนอนเด็ก','แผ่นรองคลาน','ห้องน้ำแมว','ทรายแมว']),
      closedBills: status === 'won' ? ['3' + String(10000 + Math.floor(rnd() * 89999))] : [],
      closedAmount: status === 'won' ? purchases[0].amount : null,
      closedAt: status === 'won' ? lastDay : null,
    });
  }
  // ลูกค้าทั้งหมดของแต่ละแบรนด์ (ถังตั้งต้นของแคมเปญ) ใช้กรองตอนสร้างแคมเปญ
  const customers = [];
  for (let i = 0; i < 90; i++) {
    const isHost = i % 3 === 2;
    const n = 1 + Math.floor(rnd() * 5);
    const pur = [];
    for (let k = 0; k < n; k++) {
      const p = pick(products.filter(x => isHost ? x[0].startsWith('HST') : x[0].startsWith('BBP')));
      pur.push({ date: addDays(-20 - Math.floor(rnd() * 540)), bill: String(200000 + Math.floor(rnd() * 799999)), seller: pick(reps).id, sku: p[0], product: p[1], amount: p[2] });
    }
    pur.sort((a, b) => b.date.localeCompare(a.date));
    customers.push({
      id: 'C' + (5000 + i), name: first[(i * 7 + 3) % first.length] + ' ' + last[(i * 11 + 1) % last.length],
      phone: '0' + pick(['81','86','89','92','95','64']) + String(2000000 + Math.floor(rnd() * 7999999)),
      address: 'เขต' + pick(['บางนา','ลาดพร้าว','หนองจอก','เมืองเชียงใหม่','บางกรวย']),
      brand: isHost ? 'hosttail' : 'bebeplay',
      shop: isHost ? pick(['SH_hosttail','Lazada_hosttail']) : pick(['Loo_bebeplay','SH_bebeplay','TikTok_bebeplay']),
      purchases: pur,
    });
  }
  window.DS_DATA = { reps, campaigns, leads, customers, today: iso(today) };
})();
