/* สร้างจาก legacy/data.js (หลัง applyAuto ครั้งแรก) ด้วย `TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures` ห้ามแก้มือ */
import type { FixtureData } from './types';

export const FIXTURE_DATA: FixtureData = {
 "reps": [
  {
   "id": "r1",
   "name": "อาทิตยา คชสร",
   "initials": "อค",
   "role": "sales"
  },
  {
   "id": "r2",
   "name": "กมลชนก ใจดี",
   "initials": "กจ",
   "role": "sales"
  },
  {
   "id": "r3",
   "name": "ปรีชา วงศ์ทอง",
   "initials": "ปว",
   "role": "sales"
  },
  {
   "id": "r4",
   "name": "Dev MPD",
   "initials": "DM",
   "role": "admin"
  }
 ],
 "campaigns": [
  {
   "id": "c-bebe-nov",
   "brand": "bebeplay",
   "claimMode": "self",
   "name": "Bebeplay · ลูกค้าเก่า 6 เดือน",
   "start": "2026-11-01",
   "end": "2026-11-30",
   "note": "โปรเตียงเด็กและแผ่นรองคลาน ลด 10% สำหรับลูกค้าเดิม"
  },
  {
   "id": "c-host-nov",
   "brand": "hosttail",
   "claimMode": "auto",
   "name": "Hosttail · ทาสแมวกลับมาซื้อ",
   "start": "2026-11-01",
   "end": "2026-11-30",
   "note": "ห้องน้ำแมวอัจฉริยะ + ทรายแมว แถมถุงขยะ"
  },
  {
   "id": "c-bebe-oct",
   "brand": "bebeplay",
   "claimMode": "assign",
   "name": "Bebeplay · Double Date 10.10",
   "start": "2026-10-05",
   "end": "2026-10-20",
   "note": "แคมเปญที่ปิดแล้ว"
  }
 ],
 "leads": [
  {
   "id": "L1000",
   "name": "ธนากร รุ่งเรือง",
   "phone": "0864355692",
   "address": "เขตบางกรวย",
   "shop": "LOA_bebeplay",
   "source": "self",
   "brand": "bebeplay",
   "campaignId": null,
   "owner": "r2",
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2025-09-07",
     "bill": "895016",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "baby_love100_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "baby_love100_loa"
    }
   ]
  },
  {
   "id": "L1001",
   "name": "รัชนี แสงทอง",
   "phone": "0892740809",
   "address": "เขตหนองจอก",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": null,
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-06-15",
     "bill": "652458",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "nong_mint101_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "nong_mint101_sh"
    }
   ]
  },
  {
   "id": "L1002",
   "name": "พีรพัฒน์ สุขสวัสดิ์",
   "phone": "0927636213",
   "address": "เขตบางนา",
   "shop": "SH_hosttail",
   "source": "campaign",
   "brand": "hosttail",
   "campaignId": "c-host-nov",
   "owner": "r4",
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2025-09-29",
     "bill": "754755",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "little_star102_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "little_star102_sh"
    }
   ]
  },
  {
   "id": "L1003",
   "name": "พิมพ์ชนก มั่นคง",
   "phone": "0954729320",
   "address": "เขตลาดพร้าว",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": null,
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-01-16",
     "bill": "806847",
     "seller": "r3",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "mom_ploy103_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy103_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "pet_home103_web"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "nong_mint103_loa"
    }
   ]
  },
  {
   "id": "L1004",
   "name": "สมศักดิ์ พงษ์ไทย",
   "phone": "0924363271",
   "address": "เขตบางกรวย",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": null,
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-04-29",
     "bill": "862962",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-06-04",
     "bill": "959985",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "pet_home104_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home104_sh"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "happy_mom104_loa"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "little_star104_fb"
    }
   ],
   "releasedBy": [
    "r4"
   ]
  },
  {
   "id": "L1005",
   "name": "ขวัญใจ ศรีสุข",
   "phone": "0865907646",
   "address": "เขตลาดพร้าว",
   "shop": "LOA_hosttail",
   "source": "self",
   "brand": "hosttail",
   "campaignId": null,
   "owner": "r2",
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-06-02",
     "bill": "394039",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-02-19",
     "bill": "502585",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-09-07",
     "bill": "749306",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-08-16",
     "bill": "993023",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "mom_ploy105_loa",
   "channels": [
    {
     "shop": "LOA_hosttail",
     "chat": "mom_ploy105_loa"
    }
   ]
  },
  {
   "id": "L1006",
   "name": "ณัฐวุฒิ วัฒนา",
   "phone": "0866082887",
   "address": "เขตบางนา",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": "r2",
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-07-12",
     "bill": "256419",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "happy_mom106_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom106_sh"
    }
   ]
  },
  {
   "id": "L1007",
   "name": "ศิริพร เจริญผล",
   "phone": "0647768140",
   "address": "เขตลาดพร้าว",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-oct",
   "owner": null,
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-07-28",
     "bill": "927948",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-01-28",
     "bill": "253148",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-10-27",
     "bill": "355301",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-05-18",
     "bill": "522914",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "happy_mom107_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom107_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "happy_mom107_web"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "pet_home107_fb"
    }
   ]
  },
  {
   "id": "L1008",
   "name": "ธีรเดช บุญมา",
   "phone": "0953281515",
   "address": "เขตบางนา",
   "shop": "SH_hosttail",
   "source": "campaign",
   "brand": "hosttail",
   "campaignId": "c-host-nov",
   "owner": "r2",
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-09-14",
     "bill": "828668",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-08-04",
     "bill": "295528",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-11-06",
     "bill": "981658",
     "seller": "r4",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-09-29",
     "bill": "983208",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-06-06",
     "bill": "277325",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "kid_zone108_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "kid_zone108_sh"
    },
    {
     "shop": "TT_hosttail",
     "chat": "pet_home108_tt"
    },
    {
     "shop": "FB_hosttail",
     "chat": "baby_love108_fb"
    }
   ]
  },
  {
   "id": "L1009",
   "name": "ชลธิชา ใจดี",
   "phone": "0895230143",
   "address": "เขตเมืองเชียงใหม่",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": null,
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-10-14",
     "bill": "362942",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-08-10",
     "bill": "294094",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-05-22",
     "bill": "672790",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-05-01",
     "bill": "544107",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-01-10",
     "bill": "810870",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "mama_bell109_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell109_sh"
    }
   ]
  },
  {
   "id": "L1010",
   "name": "ภาคิน รุ่งเรือง",
   "phone": "0869442145",
   "address": "เขตเมืองเชียงใหม่",
   "shop": "LOA_bebeplay",
   "source": "self",
   "brand": "bebeplay",
   "campaignId": null,
   "owner": "r1",
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-09-08",
     "bill": "535267",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2026-07-29",
     "bill": "977968",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-07-07",
     "bill": "607887",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-11-03",
     "bill": "543593",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-08-29",
     "bill": "836789",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "pet_home110_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "pet_home110_loa"
    }
   ]
  },
  {
   "id": "L1011",
   "name": "สุภาพร แสงทอง",
   "phone": "0644338237",
   "address": "เขตเมืองเชียงใหม่",
   "shop": "SH_hosttail",
   "source": "campaign",
   "brand": "hosttail",
   "campaignId": "c-host-nov",
   "owner": "r2",
   "status": "following",
   "callback": null,
   "purchases": [
    {
     "date": "2026-05-08",
     "bill": "713449",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-04-13",
     "bill": "663874",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-12-12",
     "bill": "433518",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-09-13",
     "bill": "753051",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-06-01",
     "bill": "347729",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ],
   "interactions": [
    {
     "id": "i11a",
     "type": "chat",
     "date": "2026-10-03T11:20",
     "rep": "r2",
     "result": "ไม่สะดวกให้โทร",
     "note": "ลูกค้าแจ้งว่าไม่สะดวกให้โทรอีก"
    }
   ],
   "interest": "ทรายแมว",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "cat_lover111_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "cat_lover111_sh"
    },
    {
     "shop": "LA_hosttail",
     "chat": "happy_mom111_la"
    },
    {
     "shop": "TT_hosttail",
     "chat": "mom_ploy111_tt"
    }
   ],
   "noCall": true,
   "noCallAt": "2026-10-03",
   "noCallBy": "r2"
  },
  {
   "id": "L1012",
   "name": "อนุชา สุขสวัสดิ์",
   "phone": "0818664025",
   "address": "เขตบางกรวย",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": "r2",
   "status": "won",
   "callback": null,
   "purchases": [
    {
     "date": "2026-07-14",
     "bill": "591028",
     "seller": "r2",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-03-02",
     "bill": "697928",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-08-21",
     "bill": "939807",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ],
   "interactions": [
    {
     "id": "i12a",
     "type": "call",
     "date": "2026-10-31T12:20",
     "rep": "r2",
     "result": "คุยแล้ว",
     "note": "สนใจโปร ตกลงสั่งซื้อ"
    }
   ],
   "interest": "ทรายแมว",
   "closedBills": [
    "369295"
   ],
   "closedAmount": 3290,
   "closedAt": "2026-10-31",
   "chatName": "pet_home112_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home112_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "mama_bell112_web"
    }
   ]
  },
  {
   "id": "L1013",
   "name": "จิราพร มั่นคง",
   "phone": "0814543449",
   "address": "เขตลาดพร้าว",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": "r1",
   "status": "following",
   "callback": null,
   "purchases": [
    {
     "date": "2026-10-07",
     "bill": "833291",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ],
   "interactions": [
    {
     "id": "i13a",
     "type": "chat",
     "date": "2026-11-01T13:20",
     "rep": "r1",
     "result": "ไม่สะดวกให้โทร",
     "note": "ลูกค้าแจ้งว่าไม่สะดวกให้โทรอีก"
    }
   ],
   "interest": "ห้องน้ำแมว",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "mama_bell113_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell113_sh"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "pet_home113_loa"
    }
   ],
   "noCall": true,
   "noCallAt": "2026-11-01",
   "noCallBy": "r1"
  },
  {
   "id": "L1014",
   "name": "วีรวัฒน์ พงษ์ไทย",
   "phone": "0869684532",
   "address": "เขตหนองจอก",
   "shop": "SH_hosttail",
   "source": "campaign",
   "brand": "hosttail",
   "campaignId": "c-host-nov",
   "owner": "r4",
   "status": "callback",
   "callback": "2026-11-03",
   "purchases": [
    {
     "date": "2026-05-30",
     "bill": "695596",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-01-25",
     "bill": "423703",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-01-22",
     "bill": "392523",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-12-26",
     "bill": "387681",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ],
   "interactions": [
    {
     "id": "i14a",
     "type": "call",
     "date": "2026-10-03T14:20",
     "rep": "r4",
     "result": "คุยแล้ว",
     "note": "ขอดูโปรก่อน นัดคุยอีกครั้ง"
    }
   ],
   "interest": "เตียงนอนเด็ก",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "mom_ploy114_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "mom_ploy114_sh"
    }
   ]
  },
  {
   "id": "L1015",
   "name": "กานต์ธิดา ศรีสุข",
   "phone": "0957391117",
   "address": "เขตบางนา",
   "shop": "LOA_bebeplay",
   "source": "self",
   "brand": "bebeplay",
   "campaignId": null,
   "owner": "r4",
   "status": "won",
   "callback": null,
   "purchases": [
    {
     "date": "2025-09-19",
     "bill": "418881",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ],
   "interactions": [
    {
     "id": "i15a",
     "type": "chat",
     "date": "2026-10-18T15:20",
     "rep": "r4",
     "result": "คุยแล้ว",
     "note": "สนใจโปร ตกลงสั่งซื้อ"
    }
   ],
   "interest": "เตียงนอนเด็ก",
   "closedBills": [
    "375562"
   ],
   "closedAmount": 3290,
   "closedAt": "2026-10-18",
   "chatName": "mama_bell115_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "mama_bell115_loa"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "mom_ploy115_web"
    }
   ]
  },
  {
   "id": "L1016",
   "name": "เมธัส วัฒนา",
   "phone": "0929513064",
   "address": "เขตบางนา",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": "r4",
   "status": "unreachable",
   "callback": null,
   "purchases": [
    {
     "date": "2026-06-17",
     "bill": "280994",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-04-09",
     "bill": "356810",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-12-27",
     "bill": "399800",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-09-20",
     "bill": "932749",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-06-14",
     "bill": "972543",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ],
   "interactions": [
    {
     "id": "i16a",
     "type": "call",
     "date": "2026-10-19T16:20",
     "rep": "r4",
     "result": "ไม่รับสาย",
     "note": "โทรสองครั้งไม่รับ"
    }
   ],
   "interest": "ห้องน้ำแมว",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "kid_zone116_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "kid_zone116_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "mom_ploy116_la"
    }
   ]
  },
  {
   "id": "L1017",
   "name": "นภัสสร เจริญผล",
   "phone": "0865404080",
   "address": "เขตบางกรวย",
   "shop": "SH_hosttail",
   "source": "campaign",
   "brand": "hosttail",
   "campaignId": "c-host-nov",
   "owner": "r3",
   "status": "unreachable",
   "callback": null,
   "purchases": [
    {
     "date": "2026-09-09",
     "bill": "281858",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-05-29",
     "bill": "752447",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-01-23",
     "bill": "963243",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-11-25",
     "bill": "222311",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ],
   "interactions": [
    {
     "id": "i17a",
     "type": "chat",
     "date": "2026-09-23T17:20",
     "rep": "r3",
     "result": "ไม่รับสาย",
     "note": "โทรสองครั้งไม่รับ"
    }
   ],
   "interest": "แผ่นรองคลาน",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "little_star117_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "little_star117_sh"
    },
    {
     "shop": "TT_hosttail",
     "chat": "kid_zone117_tt"
    },
    {
     "shop": "FB_hosttail",
     "chat": "nong_mint117_fb"
    }
   ]
  },
  {
   "id": "L1018",
   "name": "ปิยะนุช บุญมา",
   "phone": "0928160561",
   "address": "เขตเมืองเชียงใหม่",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": "r2",
   "status": "unreachable",
   "callback": null,
   "purchases": [
    {
     "date": "2025-09-05",
     "bill": "478490",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-08-27",
     "bill": "384951",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-07-06",
     "bill": "582290",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-05-29",
     "bill": "880328",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ],
   "interactions": [
    {
     "id": "i18a",
     "type": "call",
     "date": "2026-10-09T18:20",
     "rep": "r2",
     "result": "ไม่รับสาย",
     "note": "โทรสองครั้งไม่รับ"
    }
   ],
   "interest": "เตียงนอนเด็ก",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "happy_mom118_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom118_sh"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "baby_love118_fb"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "baby_love118_web"
    }
   ]
  },
  {
   "id": "L1019",
   "name": "อรอนงค์ ใจดี",
   "phone": "0922093004",
   "address": "เขตลาดพร้าว",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": "r2",
   "status": "callback",
   "callback": "2026-11-06",
   "purchases": [
    {
     "date": "2026-06-10",
     "bill": "926360",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ],
   "interactions": [
    {
     "id": "i19a",
     "type": "chat",
     "date": "2026-09-22T19:20",
     "rep": "r2",
     "result": "คุยแล้ว",
     "note": "ขอดูโปรก่อน นัดคุยอีกครั้ง"
    }
   ],
   "interest": "แผ่นรองคลาน",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "mom_ploy119_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy119_sh"
    }
   ]
  },
  {
   "id": "L1020",
   "name": "ธนากร รุ่งเรือง",
   "phone": "0643975308",
   "address": "เขตเมืองเชียงใหม่",
   "shop": "LOA_hosttail",
   "source": "self",
   "brand": "hosttail",
   "campaignId": null,
   "owner": "r1",
   "status": "won",
   "callback": null,
   "purchases": [
    {
     "date": "2025-12-30",
     "bill": "874940",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-06-24",
     "bill": "237712",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-05-05",
     "bill": "493775",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-04-28",
     "bill": "541703",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ],
   "interactions": [
    {
     "id": "i20a",
     "type": "call",
     "date": "2026-10-02T10:20",
     "rep": "r1",
     "result": "คุยแล้ว",
     "note": "สนใจโปร ตกลงสั่งซื้อ"
    }
   ],
   "interest": "ทรายแมว",
   "closedBills": [
    "325044"
   ],
   "closedAmount": 259,
   "closedAt": "2026-10-02",
   "chatName": "baby_love120_loa",
   "channels": [
    {
     "shop": "LOA_hosttail",
     "chat": "baby_love120_loa"
    },
    {
     "shop": "Web_hosttail",
     "chat": "baby_love120_web"
    }
   ]
  },
  {
   "id": "L1021",
   "name": "รัชนี แสงทอง",
   "phone": "0959357269",
   "address": "เขตบางกรวย",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-oct",
   "owner": "r4",
   "status": "won",
   "callback": null,
   "purchases": [
    {
     "date": "2026-07-15",
     "bill": "816065",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ],
   "interactions": [
    {
     "id": "i21a",
     "type": "chat",
     "date": "2026-09-18T11:20",
     "rep": "r4",
     "result": "คุยแล้ว",
     "note": "สนใจโปร ตกลงสั่งซื้อ"
    }
   ],
   "interest": "แผ่นรองคลาน",
   "closedBills": [
    "336887"
   ],
   "closedAmount": 790,
   "closedAt": "2026-09-18",
   "chatName": "pet_home121_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home121_sh"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "nong_mint121_fb"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "little_star121_web"
    }
   ]
  },
  {
   "id": "L1022",
   "name": "พีรพัฒน์ สุขสวัสดิ์",
   "phone": "0894915706",
   "address": "เขตบางนา",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": "r4",
   "status": "won",
   "callback": null,
   "purchases": [
    {
     "date": "2025-09-09",
     "bill": "374427",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ],
   "interactions": [
    {
     "id": "i22a",
     "type": "call",
     "date": "2026-10-28T12:20",
     "rep": "r4",
     "result": "คุยแล้ว",
     "note": "สนใจโปร ตกลงสั่งซื้อ"
    }
   ],
   "interest": "แผ่นรองคลาน",
   "closedBills": [
    "320141"
   ],
   "closedAmount": 1190,
   "closedAt": "2026-10-28",
   "chatName": "kid_zone122_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "kid_zone122_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "mama_bell122_la"
    }
   ]
  },
  {
   "id": "L1023",
   "name": "พิมพ์ชนก มั่นคง",
   "phone": "0814364471",
   "address": "เขตลาดพร้าว",
   "shop": "SH_hosttail",
   "source": "campaign",
   "brand": "hosttail",
   "campaignId": "c-host-nov",
   "owner": "r3",
   "status": "callback",
   "callback": "2026-11-04",
   "purchases": [
    {
     "date": "2026-09-09",
     "bill": "572341",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2026-08-19",
     "bill": "250627",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-12-05",
     "bill": "851257",
     "seller": "r4",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ],
   "interactions": [
    {
     "id": "i23a",
     "type": "chat",
     "date": "2026-10-08T13:20",
     "rep": "r3",
     "result": "คุยแล้ว",
     "note": "ขอดูโปรก่อน นัดคุยอีกครั้ง"
    }
   ],
   "interest": "ทรายแมว",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "mama_bell123_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "mama_bell123_sh"
    }
   ]
  },
  {
   "id": "L1024",
   "name": "สมศักดิ์ พงษ์ไทย",
   "phone": "0649848833",
   "address": "เขตหนองจอก",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": "r2",
   "status": "new",
   "callback": null,
   "purchases": [
    {
     "date": "2026-05-21",
     "bill": "844282",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ],
   "interactions": [],
   "interest": "",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "baby_love124_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "baby_love124_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "kid_zone124_web"
    }
   ]
  },
  {
   "id": "L1025",
   "name": "ขวัญใจ ศรีสุข",
   "phone": "0869040534",
   "address": "เขตเมืองเชียงใหม่",
   "shop": "LOA_bebeplay",
   "source": "self",
   "brand": "bebeplay",
   "campaignId": null,
   "owner": "r3",
   "status": "callback",
   "callback": "2026-11-03",
   "purchases": [
    {
     "date": "2025-06-12",
     "bill": "802595",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ],
   "interactions": [
    {
     "id": "i25a",
     "type": "chat",
     "date": "2026-10-02T15:20",
     "rep": "r3",
     "result": "คุยแล้ว",
     "note": "ขอดูโปรก่อน นัดคุยอีกครั้ง"
    }
   ],
   "interest": "ทรายแมว",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "kid_zone125_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "kid_zone125_loa"
    }
   ]
  },
  {
   "id": "L1026",
   "name": "ณัฐวุฒิ วัฒนา",
   "phone": "0819145060",
   "address": "เขตลาดพร้าว",
   "shop": "SH_hosttail",
   "source": "campaign",
   "brand": "hosttail",
   "campaignId": "c-host-nov",
   "owner": "r3",
   "status": "won",
   "callback": null,
   "purchases": [
    {
     "date": "2025-08-24",
     "bill": "728761",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-08-24",
     "bill": "821861",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-08-13",
     "bill": "417842",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-05-29",
     "bill": "810530",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ],
   "interactions": [
    {
     "id": "i26a",
     "type": "call",
     "date": "2026-10-28T16:20",
     "rep": "r3",
     "result": "คุยแล้ว",
     "note": "สนใจโปร ตกลงสั่งซื้อ"
    }
   ],
   "interest": "เตียงนอนเด็ก",
   "closedBills": [
    "356765"
   ],
   "closedAmount": 4990,
   "closedAt": "2026-10-28",
   "chatName": "little_star126_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "little_star126_sh"
    },
    {
     "shop": "FB_hosttail",
     "chat": "kid_zone126_fb"
    }
   ]
  },
  {
   "id": "L1027",
   "name": "ศิริพร เจริญผล",
   "phone": "0813264300",
   "address": "เขตบางนา",
   "shop": "SH_bebeplay",
   "source": "campaign",
   "brand": "bebeplay",
   "campaignId": "c-bebe-nov",
   "owner": "r4",
   "status": "following",
   "callback": null,
   "purchases": [
    {
     "date": "2026-07-16",
     "bill": "862670",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-12-02",
     "bill": "254536",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-07-17",
     "bill": "423357",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ],
   "interactions": [
    {
     "id": "i27a",
     "type": "chat",
     "date": "2026-09-17T17:20",
     "rep": "r4",
     "result": "คุยแล้ว",
     "note": "ขอดูโปรก่อน นัดคุยอีกครั้ง"
    }
   ],
   "interest": "เตียงนอนเด็ก",
   "closedBills": [],
   "closedAmount": null,
   "closedAt": null,
   "chatName": "mama_bell127_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell127_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "nong_mint127_la"
    }
   ]
  }
 ],
 "customers": [
  {
   "id": "C5000",
   "name": "ธนากร รุ่งเรือง",
   "phone": "0864355692",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "baby_love100_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "baby_love100_loa"
    }
   ],
   "purchases": [
    {
     "date": "2025-09-07",
     "bill": "895016",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5001",
   "name": "รัชนี แสงทอง",
   "phone": "0892740809",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "nong_mint101_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "nong_mint101_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-06-15",
     "bill": "652458",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5002",
   "name": "พีรพัฒน์ สุขสวัสดิ์",
   "phone": "0927636213",
   "address": "เขตบางนา",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "little_star102_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "little_star102_sh"
    }
   ],
   "purchases": [
    {
     "date": "2025-09-29",
     "bill": "754755",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  },
  {
   "id": "C5003",
   "name": "พิมพ์ชนก มั่นคง",
   "phone": "0954729320",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mom_ploy103_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy103_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "pet_home103_web"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "nong_mint103_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-01-16",
     "bill": "806847",
     "seller": "r3",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5004",
   "name": "สมศักดิ์ พงษ์ไทย",
   "phone": "0924363271",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "pet_home104_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home104_sh"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "happy_mom104_loa"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "little_star104_fb"
    }
   ],
   "purchases": [
    {
     "date": "2026-04-29",
     "bill": "862962",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-06-04",
     "bill": "959985",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5005",
   "name": "ขวัญใจ ศรีสุข",
   "phone": "0865907646",
   "address": "เขตลาดพร้าว",
   "brand": "hosttail",
   "shop": "LOA_hosttail",
   "chatName": "mom_ploy105_loa",
   "channels": [
    {
     "shop": "LOA_hosttail",
     "chat": "mom_ploy105_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-06-02",
     "bill": "394039",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-02-19",
     "bill": "502585",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-09-07",
     "bill": "749306",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-08-16",
     "bill": "993023",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ]
  },
  {
   "id": "C5006",
   "name": "ณัฐวุฒิ วัฒนา",
   "phone": "0866082887",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "happy_mom106_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom106_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-12",
     "bill": "256419",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5007",
   "name": "ศิริพร เจริญผล",
   "phone": "0647768140",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "happy_mom107_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom107_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "happy_mom107_web"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "pet_home107_fb"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-28",
     "bill": "927948",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-01-28",
     "bill": "253148",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-10-27",
     "bill": "355301",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-05-18",
     "bill": "522914",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5008",
   "name": "ธีรเดช บุญมา",
   "phone": "0953281515",
   "address": "เขตบางนา",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "kid_zone108_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "kid_zone108_sh"
    },
    {
     "shop": "TT_hosttail",
     "chat": "pet_home108_tt"
    },
    {
     "shop": "FB_hosttail",
     "chat": "baby_love108_fb"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-14",
     "bill": "828668",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-08-04",
     "bill": "295528",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-11-06",
     "bill": "981658",
     "seller": "r4",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-09-29",
     "bill": "983208",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-06-06",
     "bill": "277325",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  },
  {
   "id": "C5009",
   "name": "ชลธิชา ใจดี",
   "phone": "0895230143",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mama_bell109_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell109_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-14",
     "bill": "362942",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-08-10",
     "bill": "294094",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-05-22",
     "bill": "672790",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-05-01",
     "bill": "544107",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-01-10",
     "bill": "810870",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5010",
   "name": "ภาคิน รุ่งเรือง",
   "phone": "0869442145",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "pet_home110_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "pet_home110_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-08",
     "bill": "535267",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2026-07-29",
     "bill": "977968",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-07-07",
     "bill": "607887",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-11-03",
     "bill": "543593",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-08-29",
     "bill": "836789",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5011",
   "name": "สุภาพร แสงทอง",
   "phone": "0644338237",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "cat_lover111_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "cat_lover111_sh"
    },
    {
     "shop": "LA_hosttail",
     "chat": "happy_mom111_la"
    },
    {
     "shop": "TT_hosttail",
     "chat": "mom_ploy111_tt"
    }
   ],
   "purchases": [
    {
     "date": "2026-05-08",
     "bill": "713449",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-04-13",
     "bill": "663874",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-12-12",
     "bill": "433518",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-09-13",
     "bill": "753051",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-06-01",
     "bill": "347729",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5012",
   "name": "อนุชา สุขสวัสดิ์",
   "phone": "0818664025",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "pet_home112_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home112_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "mama_bell112_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-14",
     "bill": "591028",
     "seller": "r2",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-03-02",
     "bill": "697928",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-08-21",
     "bill": "939807",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5013",
   "name": "จิราพร มั่นคง",
   "phone": "0814543449",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mama_bell113_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell113_sh"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "pet_home113_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-07",
     "bill": "833291",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5014",
   "name": "วีรวัฒน์ พงษ์ไทย",
   "phone": "0869684532",
   "address": "เขตหนองจอก",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "mom_ploy114_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "mom_ploy114_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-05-30",
     "bill": "695596",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-01-25",
     "bill": "423703",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-01-22",
     "bill": "392523",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-12-26",
     "bill": "387681",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5015",
   "name": "กานต์ธิดา ศรีสุข",
   "phone": "0957391117",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "mama_bell115_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "mama_bell115_loa"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "mom_ploy115_web"
    }
   ],
   "purchases": [
    {
     "date": "2025-09-19",
     "bill": "418881",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5016",
   "name": "เมธัส วัฒนา",
   "phone": "0929513064",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "kid_zone116_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "kid_zone116_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "mom_ploy116_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-06-17",
     "bill": "280994",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-04-09",
     "bill": "356810",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-12-27",
     "bill": "399800",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-09-20",
     "bill": "932749",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-06-14",
     "bill": "972543",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5017",
   "name": "นภัสสร เจริญผล",
   "phone": "0865404080",
   "address": "เขตบางกรวย",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "little_star117_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "little_star117_sh"
    },
    {
     "shop": "TT_hosttail",
     "chat": "kid_zone117_tt"
    },
    {
     "shop": "FB_hosttail",
     "chat": "nong_mint117_fb"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-09",
     "bill": "281858",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-05-29",
     "bill": "752447",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-01-23",
     "bill": "963243",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-11-25",
     "bill": "222311",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5018",
   "name": "ปิยะนุช บุญมา",
   "phone": "0928160561",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "happy_mom118_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom118_sh"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "baby_love118_fb"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "baby_love118_web"
    }
   ],
   "purchases": [
    {
     "date": "2025-09-05",
     "bill": "478490",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-08-27",
     "bill": "384951",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-07-06",
     "bill": "582290",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-05-29",
     "bill": "880328",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5019",
   "name": "อรอนงค์ ใจดี",
   "phone": "0922093004",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mom_ploy119_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy119_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-06-10",
     "bill": "926360",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5020",
   "name": "ธนากร รุ่งเรือง",
   "phone": "0643975308",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "hosttail",
   "shop": "LOA_hosttail",
   "chatName": "baby_love120_loa",
   "channels": [
    {
     "shop": "LOA_hosttail",
     "chat": "baby_love120_loa"
    },
    {
     "shop": "Web_hosttail",
     "chat": "baby_love120_web"
    }
   ],
   "purchases": [
    {
     "date": "2025-12-30",
     "bill": "874940",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-06-24",
     "bill": "237712",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-05-05",
     "bill": "493775",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-04-28",
     "bill": "541703",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  },
  {
   "id": "C5021",
   "name": "รัชนี แสงทอง",
   "phone": "0959357269",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "pet_home121_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home121_sh"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "nong_mint121_fb"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "little_star121_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-15",
     "bill": "816065",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5022",
   "name": "พีรพัฒน์ สุขสวัสดิ์",
   "phone": "0894915706",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "kid_zone122_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "kid_zone122_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "mama_bell122_la"
    }
   ],
   "purchases": [
    {
     "date": "2025-09-09",
     "bill": "374427",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5023",
   "name": "พิมพ์ชนก มั่นคง",
   "phone": "0814364471",
   "address": "เขตลาดพร้าว",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "mama_bell123_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "mama_bell123_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-09",
     "bill": "572341",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2026-08-19",
     "bill": "250627",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-12-05",
     "bill": "851257",
     "seller": "r4",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ]
  },
  {
   "id": "C5024",
   "name": "สมศักดิ์ พงษ์ไทย",
   "phone": "0649848833",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "baby_love124_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "baby_love124_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "kid_zone124_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-05-21",
     "bill": "844282",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5025",
   "name": "ขวัญใจ ศรีสุข",
   "phone": "0869040534",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "kid_zone125_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "kid_zone125_loa"
    }
   ],
   "purchases": [
    {
     "date": "2025-06-12",
     "bill": "802595",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5026",
   "name": "ณัฐวุฒิ วัฒนา",
   "phone": "0819145060",
   "address": "เขตลาดพร้าว",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "little_star126_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "little_star126_sh"
    },
    {
     "shop": "FB_hosttail",
     "chat": "kid_zone126_fb"
    }
   ],
   "purchases": [
    {
     "date": "2025-08-24",
     "bill": "728761",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-08-24",
     "bill": "821861",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-08-13",
     "bill": "417842",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-05-29",
     "bill": "810530",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ]
  },
  {
   "id": "C5027",
   "name": "ศิริพร เจริญผล",
   "phone": "0813264300",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mama_bell127_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell127_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "nong_mint127_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-16",
     "bill": "862670",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-12-02",
     "bill": "254536",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-07-17",
     "bill": "423357",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5028",
   "name": "ธีรเดช บุญมา",
   "phone": "0928131377",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mom_ploy128_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy128_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "mama_bell128_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-13",
     "bill": "349286",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5029",
   "name": "ชลธิชา ใจดี",
   "phone": "0957306343",
   "address": "เขตหนองจอก",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "mom_ploy129_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "mom_ploy129_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-17",
     "bill": "904690",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-06-03",
     "bill": "719944",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2026-02-05",
     "bill": "958723",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2026-01-12",
     "bill": "260973",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-12-17",
     "bill": "759642",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5030",
   "name": "ภาคิน รุ่งเรือง",
   "phone": "0646940774",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "kid_zone130_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "kid_zone130_loa"
    },
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home130_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-14",
     "bill": "583627",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-07-10",
     "bill": "830445",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-07-04",
     "bill": "768085",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5031",
   "name": "สุภาพร แสงทอง",
   "phone": "0817111624",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "baby_love131_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "baby_love131_sh"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "little_star131_loa"
    },
    {
     "shop": "TT_bebeplay",
     "chat": "pet_home131_tt"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-07",
     "bill": "817756",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-12-25",
     "bill": "910033",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-11-04",
     "bill": "821240",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-08-08",
     "bill": "482242",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5032",
   "name": "อนุชา สุขสวัสดิ์",
   "phone": "0924071947",
   "address": "เขตบางนา",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "pet_home132_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "pet_home132_sh"
    },
    {
     "shop": "LA_hosttail",
     "chat": "mama_bell132_la"
    },
    {
     "shop": "Web_hosttail",
     "chat": "mom_ploy132_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-05-23",
     "bill": "988339",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-09-06",
     "bill": "723414",
     "seller": "r3",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  },
  {
   "id": "C5033",
   "name": "จิราพร มั่นคง",
   "phone": "0862300891",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "cat_lover133_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "cat_lover133_sh"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "cat_lover133_loa"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "baby_love133_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-08-17",
     "bill": "440133",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2026-05-28",
     "bill": "660174",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-05-02",
     "bill": "813987",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-07-01",
     "bill": "539817",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5034",
   "name": "วีรวัฒน์ พงษ์ไทย",
   "phone": "0863529355",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mom_ploy134_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy134_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-14",
     "bill": "903644",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-08-16",
     "bill": "478034",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-05-08",
     "bill": "710860",
     "seller": "r3",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-03-31",
     "bill": "367554",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-12-12",
     "bill": "348185",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5035",
   "name": "กานต์ธิดา ศรีสุข",
   "phone": "0869292797",
   "address": "เขตบางนา",
   "brand": "hosttail",
   "shop": "LOA_hosttail",
   "chatName": "baby_love135_loa",
   "channels": [
    {
     "shop": "LOA_hosttail",
     "chat": "baby_love135_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-01",
     "bill": "585558",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2026-09-05",
     "bill": "815283",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-07-09",
     "bill": "336464",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-05-10",
     "bill": "883692",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-04-30",
     "bill": "796984",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5036",
   "name": "เมธัส วัฒนา",
   "phone": "0957704526",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "baby_love136_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "baby_love136_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-04-13",
     "bill": "440599",
     "seller": "r2",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-01-21",
     "bill": "415716",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-09-29",
     "bill": "558199",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5037",
   "name": "นภัสสร เจริญผล",
   "phone": "0819883126",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "little_star137_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "little_star137_sh"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "little_star137_fb"
    },
    {
     "shop": "TT_bebeplay",
     "chat": "baby_love137_tt"
    }
   ],
   "purchases": [
    {
     "date": "2026-04-04",
     "bill": "966038",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-07-22",
     "bill": "749481",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5038",
   "name": "ปิยะนุช บุญมา",
   "phone": "0862922290",
   "address": "เขตหนองจอก",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "nong_mint138_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "nong_mint138_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-10",
     "bill": "246546",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-05-27",
     "bill": "417012",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-03-05",
     "bill": "781717",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-10-26",
     "bill": "606120",
     "seller": "r4",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-05-29",
     "bill": "201910",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  },
  {
   "id": "C5039",
   "name": "อรอนงค์ ใจดี",
   "phone": "0893224348",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "happy_mom139_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom139_sh"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "baby_love139_fb"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-21",
     "bill": "990475",
     "seller": "r2",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-04-09",
     "bill": "550778",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-11-16",
     "bill": "395126",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-07-30",
     "bill": "989556",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5040",
   "name": "ธนากร รุ่งเรือง",
   "phone": "0892989197",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "happy_mom140_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "happy_mom140_loa"
    },
    {
     "shop": "TT_bebeplay",
     "chat": "kid_zone140_tt"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "cat_lover140_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-08-14",
     "bill": "536539",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-12-19",
     "bill": "845084",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5041",
   "name": "รัชนี แสงทอง",
   "phone": "0924978017",
   "address": "เขตหนองจอก",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "kid_zone141_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "kid_zone141_sh"
    },
    {
     "shop": "LOA_hosttail",
     "chat": "mom_ploy141_loa"
    },
    {
     "shop": "LA_hosttail",
     "chat": "cat_lover141_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-08-06",
     "bill": "500788",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-03-17",
     "bill": "655616",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-05-28",
     "bill": "609622",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5042",
   "name": "พีรพัฒน์ สุขสวัสดิ์",
   "phone": "0923542489",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "nong_mint142_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "nong_mint142_sh"
    },
    {
     "shop": "TT_bebeplay",
     "chat": "cat_lover142_tt"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "kid_zone142_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-05-16",
     "bill": "319012",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-12-04",
     "bill": "969313",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5043",
   "name": "พิมพ์ชนก มั่นคง",
   "phone": "0819380280",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "nong_mint143_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "nong_mint143_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-04-14",
     "bill": "327722",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5044",
   "name": "สมศักดิ์ พงษ์ไทย",
   "phone": "0892152914",
   "address": "เขตบางกรวย",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "little_star144_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "little_star144_sh"
    },
    {
     "shop": "LA_hosttail",
     "chat": "cat_lover144_la"
    },
    {
     "shop": "FB_hosttail",
     "chat": "kid_zone144_fb"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-02",
     "bill": "320966",
     "seller": "r3",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-09-26",
     "bill": "620651",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-08-19",
     "bill": "304890",
     "seller": "r3",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-09-20",
     "bill": "294821",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-06-04",
     "bill": "341008",
     "seller": "r3",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  },
  {
   "id": "C5045",
   "name": "ขวัญใจ ศรีสุข",
   "phone": "0896032338",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "happy_mom145_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "happy_mom145_loa"
    },
    {
     "shop": "SH_bebeplay",
     "chat": "nong_mint145_sh"
    }
   ],
   "purchases": [
    {
     "date": "2025-12-31",
     "bill": "315514",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5046",
   "name": "ณัฐวุฒิ วัฒนา",
   "phone": "0644629252",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "pet_home146_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home146_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-12",
     "bill": "705925",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-04-12",
     "bill": "941411",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-09-16",
     "bill": "403237",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5047",
   "name": "ศิริพร เจริญผล",
   "phone": "0953323490",
   "address": "เขตบางกรวย",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "mama_bell147_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "mama_bell147_sh"
    },
    {
     "shop": "LA_hosttail",
     "chat": "kid_zone147_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-01-29",
     "bill": "835986",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5048",
   "name": "ธีรเดช บุญมา",
   "phone": "0644985013",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "baby_love148_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "baby_love148_sh"
    },
    {
     "shop": "TT_bebeplay",
     "chat": "mom_ploy148_tt"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "mom_ploy148_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-03",
     "bill": "530102",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-03-08",
     "bill": "296549",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-12-09",
     "bill": "681638",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-09-01",
     "bill": "721432",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-07-03",
     "bill": "639032",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5049",
   "name": "ชลธิชา ใจดี",
   "phone": "0924743381",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "pet_home149_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home149_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-28",
     "bill": "346872",
     "seller": "r4",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2026-05-05",
     "bill": "804676",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-03-14",
     "bill": "826172",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-02-08",
     "bill": "858901",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5050",
   "name": "ภาคิน รุ่งเรือง",
   "phone": "0896750582",
   "address": "เขตลาดพร้าว",
   "brand": "hosttail",
   "shop": "LOA_hosttail",
   "chatName": "mom_ploy150_loa",
   "channels": [
    {
     "shop": "LOA_hosttail",
     "chat": "mom_ploy150_loa"
    },
    {
     "shop": "SH_hosttail",
     "chat": "kid_zone150_sh"
    },
    {
     "shop": "FB_hosttail",
     "chat": "little_star150_fb"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-05",
     "bill": "860952",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-09-01",
     "bill": "929704",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-12-29",
     "bill": "689567",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-10-17",
     "bill": "406536",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-08-13",
     "bill": "327331",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ]
  },
  {
   "id": "C5051",
   "name": "สุภาพร แสงทอง",
   "phone": "0643759979",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "cat_lover151_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "cat_lover151_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-30",
     "bill": "491522",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2026-08-26",
     "bill": "272496",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-01-25",
     "bill": "899560",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-06-30",
     "bill": "657873",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5052",
   "name": "อนุชา สุขสวัสดิ์",
   "phone": "0644316220",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mom_ploy152_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy152_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "little_star152_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-29",
     "bill": "417372",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-06-25",
     "bill": "773119",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-05-22",
     "bill": "443806",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5053",
   "name": "จิราพร มั่นคง",
   "phone": "0642001474",
   "address": "เขตบางกรวย",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "kid_zone153_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "kid_zone153_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-05-27",
     "bill": "276481",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2026-02-23",
     "bill": "378634",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-10-29",
     "bill": "507125",
     "seller": "r4",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-09-15",
     "bill": "546247",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-06-03",
     "bill": "951281",
     "seller": "r4",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ]
  },
  {
   "id": "C5054",
   "name": "วีรวัฒน์ พงษ์ไทย",
   "phone": "0814518003",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "happy_mom154_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom154_sh"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "little_star154_fb"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "baby_love154_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-06-30",
     "bill": "700657",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-04-17",
     "bill": "452002",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-06-08",
     "bill": "604992",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-05-02",
     "bill": "606542",
     "seller": "r4",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5055",
   "name": "กานต์ธิดา ศรีสุข",
   "phone": "0814357235",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "kid_zone155_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "kid_zone155_loa"
    },
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy155_sh"
    }
   ],
   "purchases": [
    {
     "date": "2025-08-19",
     "bill": "386275",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-05-26",
     "bill": "330212",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5056",
   "name": "เมธัส วัฒนา",
   "phone": "0649153119",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "little_star156_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "little_star156_sh"
    },
    {
     "shop": "Web_hosttail",
     "chat": "cat_lover156_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-18",
     "bill": "696124",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-10-28",
     "bill": "396728",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-09-20",
     "bill": "508566",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-06-15",
     "bill": "317427",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5057",
   "name": "นภัสสร เจริญผล",
   "phone": "0894568518",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "happy_mom157_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom157_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "cat_lover157_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-03",
     "bill": "864601",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-02-03",
     "bill": "301735",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-10-03",
     "bill": "357510",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-09-28",
     "bill": "371062",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-09-27",
     "bill": "733106",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5058",
   "name": "ปิยะนุช บุญมา",
   "phone": "0815631412",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mom_ploy158_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy158_sh"
    }
   ],
   "purchases": [
    {
     "date": "2025-10-18",
     "bill": "990201",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-09-21",
     "bill": "530215",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-07-26",
     "bill": "758294",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-07-03",
     "bill": "657156",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5059",
   "name": "อรอนงค์ ใจดี",
   "phone": "0928551713",
   "address": "เขตลาดพร้าว",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "kid_zone159_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "kid_zone159_sh"
    },
    {
     "shop": "FB_hosttail",
     "chat": "mom_ploy159_fb"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-06",
     "bill": "351320",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-07-26",
     "bill": "226944",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2026-05-27",
     "bill": "768699",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-04-25",
     "bill": "842965",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-01-16",
     "bill": "965503",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ]
  },
  {
   "id": "C5060",
   "name": "ธนากร รุ่งเรือง",
   "phone": "0898408366",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "mama_bell160_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "mama_bell160_loa"
    },
    {
     "shop": "SH_bebeplay",
     "chat": "baby_love160_sh"
    }
   ],
   "purchases": [
    {
     "date": "2025-08-29",
     "bill": "220401",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-08-26",
     "bill": "458164",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-08-05",
     "bill": "860537",
     "seller": "r4",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5061",
   "name": "รัชนี แสงทอง",
   "phone": "0929560835",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mom_ploy161_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mom_ploy161_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-13",
     "bill": "603404",
     "seller": "r2",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-10-12",
     "bill": "806792",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-06-08",
     "bill": "562444",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5062",
   "name": "พีรพัฒน์ สุขสวัสดิ์",
   "phone": "0922341015",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "nong_mint162_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "nong_mint162_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-08-06",
     "bill": "322355",
     "seller": "r4",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ]
  },
  {
   "id": "C5063",
   "name": "พิมพ์ชนก มั่นคง",
   "phone": "0819672838",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "nong_mint163_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "nong_mint163_sh"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "mama_bell163_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-12",
     "bill": "548206",
     "seller": "r3",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-07-14",
     "bill": "774639",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-04-04",
     "bill": "503953",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-10-20",
     "bill": "229975",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-05-23",
     "bill": "456752",
     "seller": "r2",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5064",
   "name": "สมศักดิ์ พงษ์ไทย",
   "phone": "0814041494",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mama_bell164_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell164_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-03-13",
     "bill": "682115",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5065",
   "name": "ขวัญใจ ศรีสุข",
   "phone": "0869910972",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "hosttail",
   "shop": "LOA_hosttail",
   "chatName": "pet_home165_loa",
   "channels": [
    {
     "shop": "LOA_hosttail",
     "chat": "pet_home165_loa"
    },
    {
     "shop": "Web_hosttail",
     "chat": "nong_mint165_web"
    },
    {
     "shop": "SH_hosttail",
     "chat": "baby_love165_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-16",
     "bill": "224742",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-05-13",
     "bill": "314550",
     "seller": "r1",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2025-11-25",
     "bill": "371436",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  },
  {
   "id": "C5066",
   "name": "ณัฐวุฒิ วัฒนา",
   "phone": "0957574690",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "cat_lover166_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "cat_lover166_sh"
    }
   ],
   "purchases": [
    {
     "date": "2025-12-31",
     "bill": "485352",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-12-27",
     "bill": "295517",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-11-25",
     "bill": "200771",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-09-23",
     "bill": "794090",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5067",
   "name": "ศิริพร เจริญผล",
   "phone": "0956393998",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "kid_zone167_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "kid_zone167_sh"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "mom_ploy167_loa"
    },
    {
     "shop": "TT_bebeplay",
     "chat": "nong_mint167_tt"
    }
   ],
   "purchases": [
    {
     "date": "2026-05-17",
     "bill": "897499",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-09-05",
     "bill": "350078",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-05-04",
     "bill": "888541",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5068",
   "name": "ธีรเดช บุญมา",
   "phone": "0817956755",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "baby_love168_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "baby_love168_sh"
    },
    {
     "shop": "TT_hosttail",
     "chat": "cat_lover168_tt"
    },
    {
     "shop": "LA_hosttail",
     "chat": "happy_mom168_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-06-06",
     "bill": "514903",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-04-04",
     "bill": "653078",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2026-01-08",
     "bill": "959059",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-01-07",
     "bill": "817591",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-10-24",
     "bill": "820691",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5069",
   "name": "ชลธิชา ใจดี",
   "phone": "0956676165",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mama_bell169_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell169_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-04-14",
     "bill": "479437",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-02-25",
     "bill": "859779",
     "seller": "r4",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5070",
   "name": "ภาคิน รุ่งเรือง",
   "phone": "0952451954",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "little_star170_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "little_star170_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-07",
     "bill": "841885",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-09-23",
     "bill": "927385",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-06-07",
     "bill": "239128",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-01-01",
     "bill": "337990",
     "seller": "r3",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-06-25",
     "bill": "611048",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5071",
   "name": "สุภาพร แสงทอง",
   "phone": "0649378394",
   "address": "เขตหนองจอก",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "cat_lover171_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "cat_lover171_sh"
    },
    {
     "shop": "Web_hosttail",
     "chat": "baby_love171_web"
    },
    {
     "shop": "LOA_hosttail",
     "chat": "baby_love171_loa"
    }
   ],
   "purchases": [
    {
     "date": "2025-12-22",
     "bill": "549533",
     "seller": "r4",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5072",
   "name": "อนุชา สุขสวัสดิ์",
   "phone": "0648986213",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "cat_lover172_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "cat_lover172_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "little_star172_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-01",
     "bill": "286004",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5073",
   "name": "จิราพร มั่นคง",
   "phone": "0956949862",
   "address": "เขตบางนา",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "little_star173_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "little_star173_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "pet_home173_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-08-03",
     "bill": "549762",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-07-14",
     "bill": "841847",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-04-13",
     "bill": "471669",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5074",
   "name": "วีรวัฒน์ พงษ์ไทย",
   "phone": "0643829766",
   "address": "เขตหนองจอก",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "pet_home174_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "pet_home174_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-08",
     "bill": "797979",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-04-25",
     "bill": "622574",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  },
  {
   "id": "C5075",
   "name": "กานต์ธิดา ศรีสุข",
   "phone": "0956069615",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "little_star175_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "little_star175_loa"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "mom_ploy175_la"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "mom_ploy175_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-05-08",
     "bill": "553967",
     "seller": "r3",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2026-03-08",
     "bill": "926710",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-11-23",
     "bill": "910976",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5076",
   "name": "เมธัส วัฒนา",
   "phone": "0957521227",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mama_bell176_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell176_sh"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "nong_mint176_fb"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "little_star176_la"
    }
   ],
   "purchases": [
    {
     "date": "2025-09-11",
     "bill": "364180",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5077",
   "name": "นภัสสร เจริญผล",
   "phone": "0954364574",
   "address": "เขตลาดพร้าว",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "nong_mint177_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "nong_mint177_sh"
    },
    {
     "shop": "Web_hosttail",
     "chat": "mama_bell177_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-06-30",
     "bill": "690301",
     "seller": "r3",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    },
    {
     "date": "2026-01-04",
     "bill": "988147",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5078",
   "name": "ปิยะนุช บุญมา",
   "phone": "0893816049",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "pet_home178_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "pet_home178_sh"
    },
    {
     "shop": "TT_bebeplay",
     "chat": "cat_lover178_tt"
    },
    {
     "shop": "LOA_bebeplay",
     "chat": "nong_mint178_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-10-01",
     "bill": "346748",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-12-23",
     "bill": "611673",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-06-07",
     "bill": "715280",
     "seller": "r4",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5079",
   "name": "อรอนงค์ ใจดี",
   "phone": "0868835081",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "baby_love179_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "baby_love179_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "mom_ploy179_la"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "mama_bell179_fb"
    }
   ],
   "purchases": [
    {
     "date": "2025-11-28",
     "bill": "511251",
     "seller": "r4",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5080",
   "name": "ธนากร รุ่งเรือง",
   "phone": "0815515260",
   "address": "เขตบางนา",
   "brand": "hosttail",
   "shop": "LOA_hosttail",
   "chatName": "mama_bell180_loa",
   "channels": [
    {
     "shop": "LOA_hosttail",
     "chat": "mama_bell180_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-04-29",
     "bill": "607790",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-01-25",
     "bill": "820232",
     "seller": "r1",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2025-12-18",
     "bill": "745870",
     "seller": "r3",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-10-20",
     "bill": "629094",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  },
  {
   "id": "C5081",
   "name": "รัชนี แสงทอง",
   "phone": "0924088922",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mama_bell181_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell181_sh"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "mama_bell181_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-15",
     "bill": "971789",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-07-07",
     "bill": "270267",
     "seller": "r1",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2025-05-28",
     "bill": "678593",
     "seller": "r2",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-05-04",
     "bill": "342887",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5082",
   "name": "พีรพัฒน์ สุขสวัสดิ์",
   "phone": "0646201988",
   "address": "เขตหนองจอก",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "nong_mint182_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "nong_mint182_sh"
    },
    {
     "shop": "Web_bebeplay",
     "chat": "baby_love182_web"
    }
   ],
   "purchases": [
    {
     "date": "2025-12-23",
     "bill": "754793",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-11-07",
     "bill": "224849",
     "seller": "r1",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-05-21",
     "bill": "847166",
     "seller": "r2",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    }
   ]
  },
  {
   "id": "C5083",
   "name": "พิมพ์ชนก มั่นคง",
   "phone": "0955220095",
   "address": "เขตบางกรวย",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "mama_bell183_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "mama_bell183_sh"
    },
    {
     "shop": "LA_hosttail",
     "chat": "little_star183_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-08-26",
     "bill": "957855",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-05-11",
     "bill": "438610",
     "seller": "r2",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2026-03-28",
     "bill": "663932",
     "seller": "r1",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    },
    {
     "date": "2025-09-13",
     "bill": "781532",
     "seller": "r2",
     "sku": "HST-SAND-5",
     "product": "ทรายแมวเต้าหู้ 5 ลิตร",
     "amount": 259
    }
   ]
  },
  {
   "id": "C5084",
   "name": "สมศักดิ์ พงษ์ไทย",
   "phone": "0926761316",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "mama_bell184_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "mama_bell184_sh"
    }
   ],
   "purchases": [
    {
     "date": "2026-08-12",
     "bill": "439913",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-07-30",
     "bill": "777170",
     "seller": "r3",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    },
    {
     "date": "2026-02-15",
     "bill": "672204",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2026-02-09",
     "bill": "254632",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-05-16",
     "bill": "730544",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5085",
   "name": "ขวัญใจ ศรีสุข",
   "phone": "0643420610",
   "address": "เขตบางกรวย",
   "brand": "bebeplay",
   "shop": "LOA_bebeplay",
   "chatName": "mama_bell185_loa",
   "channels": [
    {
     "shop": "LOA_bebeplay",
     "chat": "mama_bell185_loa"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "cat_lover185_la"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "pet_home185_fb"
    }
   ],
   "purchases": [
    {
     "date": "2025-08-14",
     "bill": "240346",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-07-08",
     "bill": "976339",
     "seller": "r1",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2025-05-23",
     "bill": "605050",
     "seller": "r2",
     "sku": "BBP-PLAY-01",
     "product": "แผ่นรองคลาน Playtime 180x200",
     "amount": 790
    }
   ]
  },
  {
   "id": "C5086",
   "name": "ณัฐวุฒิ วัฒนา",
   "phone": "0866684978",
   "address": "เขตบางนา",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "mama_bell186_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "mama_bell186_sh"
    },
    {
     "shop": "LOA_hosttail",
     "chat": "little_star186_loa"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-30",
     "bill": "352160",
     "seller": "r2",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    },
    {
     "date": "2026-07-17",
     "bill": "513572",
     "seller": "r4",
     "sku": "HST-LITTER-2",
     "product": "ห้องน้ำแมวอัจฉริยะ รุ่น 2",
     "amount": 4990
    }
   ]
  },
  {
   "id": "C5087",
   "name": "ศิริพร เจริญผล",
   "phone": "0926168586",
   "address": "เขตเมืองเชียงใหม่",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "little_star187_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "little_star187_sh"
    },
    {
     "shop": "FB_bebeplay",
     "chat": "mom_ploy187_fb"
    },
    {
     "shop": "LA_bebeplay",
     "chat": "happy_mom187_la"
    }
   ],
   "purchases": [
    {
     "date": "2026-07-29",
     "bill": "759872",
     "seller": "r2",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2026-05-03",
     "bill": "841641",
     "seller": "r1",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2026-01-19",
     "bill": "715620",
     "seller": "r4",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    },
    {
     "date": "2025-08-03",
     "bill": "586306",
     "seller": "r3",
     "sku": "BBP-BED-03",
     "product": "เตียงนอนไม้พับได้ รุ่น Little Home",
     "amount": 3290
    }
   ]
  },
  {
   "id": "C5088",
   "name": "ธีรเดช บุญมา",
   "phone": "0645926474",
   "address": "เขตลาดพร้าว",
   "brand": "bebeplay",
   "shop": "SH_bebeplay",
   "chatName": "happy_mom188_sh",
   "channels": [
    {
     "shop": "SH_bebeplay",
     "chat": "happy_mom188_sh"
    },
    {
     "shop": "TT_bebeplay",
     "chat": "mom_ploy188_tt"
    }
   ],
   "purchases": [
    {
     "date": "2026-09-14",
     "bill": "236409",
     "seller": "r3",
     "sku": "BBP-EVA-06",
     "product": "แผ่น EVA รองนอนสุขุม หนา 6 มม.",
     "amount": 1190
    },
    {
     "date": "2026-05-06",
     "bill": "264200",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    },
    {
     "date": "2025-11-01",
     "bill": "375407",
     "seller": "r3",
     "sku": "BBP-FENCE",
     "product": "คอกกั้นเด็ก 8 ชิ้น",
     "amount": 2490
    }
   ]
  },
  {
   "id": "C5089",
   "name": "ชลธิชา ใจดี",
   "phone": "0892620713",
   "address": "เขตบางกรวย",
   "brand": "hosttail",
   "shop": "SH_hosttail",
   "chatName": "nong_mint189_sh",
   "channels": [
    {
     "shop": "SH_hosttail",
     "chat": "nong_mint189_sh"
    },
    {
     "shop": "Web_hosttail",
     "chat": "happy_mom189_web"
    }
   ],
   "purchases": [
    {
     "date": "2026-06-16",
     "bill": "649042",
     "seller": "r4",
     "sku": "HST-MAT-01",
     "product": "แผ่นรองกันลื่นสัตว์เลี้ยง",
     "amount": 390
    }
   ]
  }
 ],
 "today": "2026-11-04"
};
