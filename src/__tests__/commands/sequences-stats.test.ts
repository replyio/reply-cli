import {describe, it, expect, beforeEach, vi} from 'vitest';

const mocks = vi.hoisted(()=>({
    get: vi.fn(),
    resolve_api_key: vi.fn(),
    print: vi.fn(),
    print_table: vi.fn(),
    info: vi.fn(),
    status_label: vi.fn((c: number)=>c === 2 ? 'Active' : 'New'),
    truncate: vi.fn((s: string)=>s),
    pct: vi.fn(()=>'10.0%'),
    pc: {bold: (s: string)=>s, green: (s: string)=>s, yellow: (s: string)=>s, dim: (s: string)=>s, cyan: (s: string)=>s},
}));

vi.mock('../../utils/client', ()=>({get: mocks.get}));
vi.mock('../../utils/auth', ()=>({resolve_api_key: mocks.resolve_api_key}));
vi.mock('../../utils/output', ()=>({
    print: mocks.print, print_table: mocks.print_table, info: mocks.info,
    status_label: mocks.status_label, truncate: mocks.truncate, pct: mocks.pct,
    pc: mocks.pc,
}));

import {handle_top, handle_summary} from '../../commands/sequences-stats';

const CAMPAIGNS = [
    {id: 1, name: 'Seq A', status: 2, deliveriesCount: 100, opensCount: 50,
     repliesCount: 10, bouncesCount: 2, optOutsCount: 1, outOfOfficeCount: 0,
     peopleCount: 20, peopleActive: 10, peopleFinished: 8, peoplePaused: 2},
    {id: 2, name: 'Seq B', status: 0, deliveriesCount: 0, opensCount: 0,
     repliesCount: 0, bouncesCount: 0, optOutsCount: 0, outOfOfficeCount: 0,
     peopleCount: 0, peopleActive: 0, peopleFinished: 0, peoplePaused: 0},
];

describe('commands/sequences-stats', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
    });

    describe('top', ()=>{
        it('shows info when no sequences', async()=>{
            mocks.get.mockResolvedValue([]);
            await handle_top('key', {});
            expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('No sequences'));
        });

        it('filters to sequences with deliveries and ranks by reply rate', async()=>{
            mocks.get.mockResolvedValue(CAMPAIGNS);
            await handle_top('key', {});
            expect(mocks.print_table).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({Rank: '1', Name: 'Seq A'})]),
                expect.any(Array),
            );
        });
    });

    describe('summary', ()=>{
        it('shows aggregate stats', async()=>{
            mocks.get.mockResolvedValue(CAMPAIGNS);
            const log_spy = vi.spyOn(console, 'log').mockImplementation(()=>{});
            await handle_summary('key', {});
            // Should print without errors
            expect(log_spy).toHaveBeenCalled();
            log_spy.mockRestore();
        });

        it('returns JSON with --json', async()=>{
            mocks.get.mockResolvedValue(CAMPAIGNS);
            await handle_summary('key', {json: true});
            expect(mocks.print).toHaveBeenCalledWith(
                expect.objectContaining({
                    sequences: expect.objectContaining({total: 2, active: 1}),
                }),
                {json: true},
            );
        });
    });
});
