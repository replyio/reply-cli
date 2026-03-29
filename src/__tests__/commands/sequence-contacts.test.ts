import {describe, it, expect, beforeEach, vi} from 'vitest';

const mocks = vi.hoisted(()=>({
    post: vi.fn(),
    resolve_api_key: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    fail: vi.fn((msg: string): never=>{ throw new Error(`fail:${msg}`); }),
}));

vi.mock('../../utils/client', ()=>({post: mocks.post}));
vi.mock('../../utils/auth', ()=>({resolve_api_key: mocks.resolve_api_key}));
vi.mock('../../utils/output', ()=>({
    success: mocks.success, info: mocks.info, fail: mocks.fail,
}));

import {handle_add, handle_add_new, handle_add_bulk, handle_remove, handle_remove_all} from '../../commands/sequence-contacts';

describe('commands/sequence-contacts', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
    });

    describe('add', ()=>{
        it('pushes contact to sequence', async()=>{
            mocks.post.mockResolvedValue(null);
            await handle_add('key', 'john@co.com', '100');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/actions/pushtocampaign', {
                campaignId: 100, email: 'john@co.com',
            });
            expect(mocks.success).toHaveBeenCalled();
        });

        it('force pushes with flag', async()=>{
            mocks.post.mockResolvedValue(null);
            await handle_add('key', 'john@co.com', '100', true);
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/actions/pushtocampaign', {
                campaignId: 100, email: 'john@co.com', forcePush: true,
            });
        });
    });

    describe('add-new', ()=>{
        it('creates and pushes contact', async()=>{
            mocks.post.mockResolvedValue(null);
            await handle_add_new('key', {
                contact: 'john@co.com', firstName: 'John', sequence: '100',
            });
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/actions/addandpushtocampaign', {
                campaignId: 100, email: 'john@co.com', firstName: 'John',
            });
        });

        it('fails without required fields', async()=>{
            await expect(handle_add_new('key', {contact: 'john@co.com'}))
                .rejects.toThrow('fail:');
        });
    });

    describe('add-bulk', ()=>{
        it('pushes multiple contacts', async()=>{
            mocks.post.mockResolvedValue({affectedIdList: [1, 2, 3]});
            await handle_add_bulk('key', '1,2,3', '100');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/Actions/pushContactsToSequence', {
                ContactIds: [1, 2, 3], SequenceId: 100, OverwriteExisting: false,
            });
            expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('Bulk push'));
        });

        it('supports overwrite flag', async()=>{
            mocks.post.mockResolvedValue({affectedIdList: [1]});
            await handle_add_bulk('key', '1', '100', true);
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/Actions/pushContactsToSequence',
                expect.objectContaining({OverwriteExisting: true}));
        });
    });

    describe('remove', ()=>{
        it('removes from specific sequence', async()=>{
            mocks.post.mockResolvedValue(null);
            await handle_remove('key', 'john@co.com', '100');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/actions/removepersonfromcampaignbyid', {
                campaignId: 100, email: 'john@co.com',
            });
        });
    });

    describe('remove-all', ()=>{
        it('removes from all sequences', async()=>{
            mocks.post.mockResolvedValue(null);
            await handle_remove_all('key', 'john@co.com');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/actions/removepersonfromallcampaigns', {
                email: 'john@co.com',
            });
        });
    });
});
