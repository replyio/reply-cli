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
    status_label: vi.fn(()=>'Active'),
    truncate: vi.fn((s: string)=>s),
    format_date: vi.fn(()=>'Jan 1, 2025'),
    pct: vi.fn(()=>'10.0%'),
    pc: {bold: (s: string)=>s, green: (s: string)=>s, red: (s: string)=>s, dim: (s: string)=>s, cyan: (s: string)=>s},
}));

vi.mock('../../utils/client', ()=>({get: mocks.get, post: mocks.post, del: mocks.del}));
vi.mock('../../utils/auth', ()=>({resolve_api_key: mocks.resolve_api_key}));
vi.mock('../../utils/output', ()=>({
    print: mocks.print, print_table: mocks.print_table, success: mocks.success,
    info: mocks.info, fail: mocks.fail, status_label: mocks.status_label,
    truncate: mocks.truncate, format_date: mocks.format_date, pct: mocks.pct, pc: mocks.pc,
}));

import {
    handle_list, handle_get, handle_create, handle_delete,
    handle_search, handle_mark_replied, handle_mark_finished, handle_opt_out,
} from '../../commands/contacts';

const CONTACT = {
    id: 123, email: 'john@co.com', firstName: 'John', lastName: 'Smith',
    company: 'Acme', title: 'CEO', addingDate: '2025-01-01',
};

describe('commands/contacts', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
    });

    describe('list', ()=>{
        it('shows info when no contacts', async()=>{
            mocks.get.mockResolvedValue({people: [], total: 0});
            await handle_list('key', {});
            expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('No contacts'));
        });

        it('prints table for contacts', async()=>{
            mocks.get.mockResolvedValue({people: [CONTACT], total: 1, page: 1, pagesCount: 1});
            await handle_list('key', {});
            expect(mocks.print_table).toHaveBeenCalled();
        });
    });

    describe('get', ()=>{
        it('fetches by email', async()=>{
            mocks.get.mockResolvedValue(CONTACT);
            await handle_get('key', 'john@co.com', {});
            expect(mocks.get).toHaveBeenCalledWith('key', '/v1/people?email=john%40co.com');
        });

        it('fetches by ID', async()=>{
            mocks.get.mockResolvedValue(CONTACT);
            await handle_get('key', '123', {});
            expect(mocks.get).toHaveBeenCalledWith('key', '/v1/people?id=123');
        });

        it('shows info when not found', async()=>{
            mocks.get.mockResolvedValue(null);
            await handle_get('key', 'nobody@co.com', {});
            expect(mocks.info).toHaveBeenCalledWith('Contact not found.');
        });
    });

    describe('create', ()=>{
        it('fails without required fields', async()=>{
            await expect(handle_create('key', {}, {})).rejects.toThrow('fail:');
        });

        it('creates contact with all fields', async()=>{
            mocks.post.mockResolvedValue(CONTACT);
            await handle_create('key', {
                email: 'john@co.com', firstName: 'John', lastName: 'Smith',
                company: 'Acme', title: 'CEO',
            }, {});
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/people', expect.objectContaining({
                email: 'john@co.com', firstName: 'John',
            }));
            expect(mocks.success).toHaveBeenCalled();
        });

        it('parses custom fields', async()=>{
            mocks.post.mockResolvedValue(CONTACT);
            await handle_create('key', {
                email: 'john@co.com', firstName: 'John', custom: 'Source=Web,Score=10',
            }, {});
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/people', expect.objectContaining({
                customFields: [
                    {key: 'Source', value: 'Web'},
                    {key: 'Score', value: '10'},
                ],
            }));
        });
    });

    describe('delete', ()=>{
        it('deletes by email', async()=>{
            mocks.del.mockResolvedValue(null);
            await handle_delete('key', 'john@co.com');
            expect(mocks.del).toHaveBeenCalledWith('key', '/v1/people/?email=john%40co.com');
            expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('john@co.com'));
        });

        it('deletes by ID', async()=>{
            mocks.del.mockResolvedValue(null);
            await handle_delete('key', '123');
            expect(mocks.del).toHaveBeenCalledWith('key', '/v1/people/?id=123');
        });
    });

    describe('search', ()=>{
        it('searches by email', async()=>{
            mocks.get.mockResolvedValue(CONTACT);
            await handle_search('key', {email: 'john@co.com'}, {});
            expect(mocks.get).toHaveBeenCalledWith('key', '/v1/people?email=john%40co.com');
            expect(mocks.success).toHaveBeenCalled();
        });

        it('searches by linkedin', async()=>{
            mocks.post.mockResolvedValue({ids: [123]});
            await handle_search('key', {linkedin: 'https://linkedin.com/in/john'}, {});
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/people/lookup',
                {linkedin: 'https://linkedin.com/in/john'});
            expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('123'));
        });

        it('fails without search criteria', async()=>{
            await expect(handle_search('key', {}, {})).rejects.toThrow('fail:');
        });
    });

    describe('lifecycle', ()=>{
        it('mark-replied calls correct endpoint', async()=>{
            mocks.post.mockResolvedValue(null);
            await handle_mark_replied('key', 'john@co.com');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/actions/markasreplied', {email: 'john@co.com'});
        });

        it('mark-finished calls correct endpoint', async()=>{
            mocks.post.mockResolvedValue(null);
            await handle_mark_finished('key', 'john@co.com');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/actions/markasfinished', {email: 'john@co.com'});
        });

        it('opt-out calls correct endpoint', async()=>{
            mocks.post.mockResolvedValue(null);
            await handle_opt_out('key', 'john@co.com');
            expect(mocks.post).toHaveBeenCalledWith('key', '/v1/actions/removepersonfromallcampaigns', {email: 'john@co.com'});
        });
    });
});
