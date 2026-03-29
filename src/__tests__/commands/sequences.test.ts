import {describe, it, expect, beforeEach, vi} from 'vitest';

const mocks = vi.hoisted(()=>({
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    resolve_api_key: vi.fn(),
    print: vi.fn(),
    print_table: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    fail: vi.fn((msg: string): never=>{ throw new Error(`fail:${msg}`); }),
    status_label: vi.fn((c: number)=>c === 2 ? 'Active' : 'New'),
    truncate: vi.fn((s: string)=>s),
    format_date: vi.fn(()=>'Jan 1, 2025'),
    pc: {bold: (s: string)=>s, green: (s: string)=>s, dim: (s: string)=>s, cyan: (s: string)=>s},
}));

vi.mock('../../utils/client', ()=>({get: mocks.get, post: mocks.post, patch: mocks.patch}));
vi.mock('../../utils/auth', ()=>({resolve_api_key: mocks.resolve_api_key}));
vi.mock('../../utils/output', ()=>({
    print: mocks.print, print_table: mocks.print_table, success: mocks.success,
    info: mocks.info, fail: mocks.fail, status_label: mocks.status_label,
    truncate: mocks.truncate, format_date: mocks.format_date, pc: mocks.pc,
}));

import {handle_list, handle_get, handle_start, handle_pause, handle_archive} from '../../commands/sequences';

const CAMPAIGN = {
    id: 100, name: 'Test Seq', status: 2, emailAccounts: ['a@b.com'],
    peopleCount: 10, peopleActive: 5, peopleFinished: 3, peoplePaused: 2,
    deliveriesCount: 50, opensCount: 20, repliesCount: 5,
    bouncesCount: 1, optOutsCount: 0, outOfOfficeCount: 0, created: '2025-01-01',
};

describe('commands/sequences', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
    });

    describe('list', ()=>{
        it('shows info when no sequences', async()=>{
            mocks.get.mockResolvedValue([]);
            await handle_list('key', {});
            expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('No sequences'));
        });

        it('prints table for sequences', async()=>{
            mocks.get.mockResolvedValue([CAMPAIGN]);
            await handle_list('key', {});
            expect(mocks.print_table).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ID: '100'})]),
                expect.arrayContaining(['ID', 'Name']),
            );
        });

        it('prints JSON with --json', async()=>{
            mocks.get.mockResolvedValue([CAMPAIGN]);
            await handle_list('key', {json: true});
            expect(mocks.print).toHaveBeenCalledWith([CAMPAIGN], {json: true});
        });
    });

    describe('get', ()=>{
        it('shows info when not found', async()=>{
            mocks.get.mockResolvedValue([]);
            await handle_get('key', '999', {});
            expect(mocks.info).toHaveBeenCalledWith('Sequence not found.');
        });

        it('fetches campaign and steps', async()=>{
            mocks.get
                .mockResolvedValueOnce([CAMPAIGN]) // campaign
                .mockResolvedValueOnce([]); // steps
            const log_spy = vi.spyOn(console, 'log').mockImplementation(()=>{});
            await handle_get('key', '100', {});
            expect(mocks.get).toHaveBeenCalledWith('key', '/v1/campaigns?id=100');
            expect(mocks.get).toHaveBeenCalledWith('key', '/v2/campaigns/100/steps');
            log_spy.mockRestore();
        });
    });

    describe('start', ()=>{
        it('starts sequence', async()=>{
            mocks.post.mockResolvedValue({status: 'Active'});
            await handle_start('key', '100');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v2/campaigns/100/start');
            expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('started'));
        });
    });

    describe('pause', ()=>{
        it('pauses sequence', async()=>{
            mocks.post.mockResolvedValue({status: 'Paused'});
            await handle_pause('key', '100');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v2/campaigns/100/pause');
            expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('paused'));
        });
    });

    describe('archive', ()=>{
        it('archives sequence', async()=>{
            mocks.post.mockResolvedValue({});
            await handle_archive('key', '100');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v2/campaigns/100/archive');
            expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('archived'));
        });
    });
});
