import { describe, expect, it } from 'vitest';
import { DEFAULT_RFM_CONFIG } from './rfm';
import { RFM_SCOPE_LABEL, rfmMapStats, rfmPageFromQuery, rfmPageToQuery, rfmPercent, rfmScopes, rfmSummaryText } from './rfmPage';

describe('/rfm page state', () => {
  it('scopes: the team view is for a head who is not viewing as a rep', () => {
    expect(rfmScopes(true)).toEqual(['team', 'mine', 'pool']);
    expect(rfmScopes(false)).toEqual(['mine', 'pool']);
    expect(RFM_SCOPE_LABEL).toEqual({ team: 'ทั้งทีม', mine: 'ลูกค้าของฉัน', pool: 'ถังกลาง' });
  });
  it('reads segment and scope from the URL, dropping unknown values', () => {
    const head = rfmScopes(true);
    const rep = rfmScopes(false);
    expect(rfmPageFromQuery('?seg=Sleepers&scope=pool', head, DEFAULT_RFM_CONFIG)).toEqual({ seg: 'Sleepers', scope: 'pool' });
    expect(rfmPageFromQuery("?seg=Shouldn't+Lose", head, DEFAULT_RFM_CONFIG)).toEqual({ seg: "Shouldn't Lose", scope: 'team' });
    expect(rfmPageFromQuery('?seg=Nope&scope=team', rep, DEFAULT_RFM_CONFIG)).toEqual({ seg: '', scope: 'mine' });
    expect(rfmPageFromQuery('', rep, DEFAULT_RFM_CONFIG)).toEqual({ seg: '', scope: 'mine' });
  });
  it('writes only what differs from the default', () => {
    expect(rfmPageToQuery({ seg: '', scope: 'team' }, 'team')).toBe('');
    expect(rfmPageToQuery({ seg: 'Need Attention', scope: 'team' }, 'team')).toBe('seg=Need+Attention');
    expect(rfmPageToQuery({ seg: 'Lost', scope: 'pool' }, 'mine')).toBe('seg=Lost&scope=pool');
  });
  it('map statistics, percent and summary text', () => {
    const st = rfmMapStats([{ segment: 'Lost', n: '6938', contactable: 6938 }, { segment: 'Hot', n: 483, contactable: '12' }, { segment: '', n: 9389, contactable: 0 }]);
    expect(st).toEqual({ n: { Lost: 6938, Hot: 483, '': 9389 }, contactable: { Lost: 6938, Hot: 12, '': 0 }, scored: 7421, unscored: 9389 });
    expect([rfmPercent(232, 9082), rfmPercent(6938, 9082), rfmPercent(24, 9082), rfmPercent(1, 0)]).toEqual(['2.6%', '76.4%', '0.3%', '—']);
    expect(rfmSummaryText(9082, 9389)).toBe('จัดกลุ่มแล้ว 9,082 ราย · ยังไม่มีข้อมูลการซื้อ 9,389 ราย');
  });
});
