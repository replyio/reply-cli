import {describe, it, expect, beforeEach, vi} from 'vitest';

const mocks = vi.hoisted(()=>({
    get: vi.fn(),
    post: vi.fn(),
    del: vi.fn(),
    resolve_api_key: vi.fn(),
    print: vi.fn(),
    print_table: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    fail: vi.fn((msg: string): never=>{ throw new Error(`fail:${msg}`); }),
}));

vi.mock('../../utils/client', ()=>({get: mocks.get, post: mocks.post, del: mocks.del}));
vi.mock('../../utils/auth', ()=>({resolve_api_key: mocks.resolve_api_key}));
vi.mock('../../utils/output', ()=>({
    print: mocks.print, print_table: mocks.print_table, success: mocks.success,
    info: mocks.info, fail: mocks.fail,
}));

import {handle_list, handle_get, handle_delete, handle_set_default} from '../../commands/schedules';

const SCHEDULE = {
    id: 1, name: 'Business Hours', timezoneId: 'Eastern Standard Time',
    isDefault: true, mainTimings: [{
        weekDay: 'Monday', isActive: true,
        timeRanges: [{fromTime: {hour: 9, minute: 0}, toTime: {hour: 17, minute: 0}}],
    }],
};

describe('commands/schedules', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
    });

    describe('list', ()=>{
        it('shows info when no schedules', async()=>{
            mocks.get.mockResolvedValue([]);
            await handle_list('key', {});
            expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('No schedules'));
        });

        it('prints table', async()=>{
            mocks.get.mockResolvedValue([SCHEDULE]);
            await handle_list('key', {});
            expect(mocks.print_table).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ID: '1', Name: 'Business Hours'})]),
                expect.any(Array),
            );
        });
    });

    describe('get', ()=>{
        it('fetches and prints schedule', async()=>{
            mocks.get.mockResolvedValue(SCHEDULE);
            await handle_get('key', '1', {});
            expect(mocks.get).toHaveBeenCalledWith('key', '/v2/schedules/1');
            expect(mocks.print).toHaveBeenCalled();
        });
    });

    describe('delete', ()=>{
        it('deletes schedule', async()=>{
            mocks.del.mockResolvedValue(null);
            await handle_delete('key', '1');
            expect(mocks.del).toHaveBeenCalledWith('key', '/v2/schedules/1');
            expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('deleted'));
        });
    });

    describe('set-default', ()=>{
        it('sets schedule as default', async()=>{
            mocks.post.mockResolvedValue(null);
            await handle_set_default('key', '1');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v2/schedules/1/set-default');
            expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('default'));
        });
    });
});
