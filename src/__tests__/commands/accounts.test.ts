import {describe, it, expect, beforeEach, vi} from 'vitest';

const mocks = vi.hoisted(()=>({
    get: vi.fn(),
    resolve_api_key: vi.fn(),
    print: vi.fn(),
    print_table: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    fail: vi.fn((msg: string)=>{ throw new Error(`fail:${msg}`); }),
}));

vi.mock('../../utils/client', ()=>({get: mocks.get}));
vi.mock('../../utils/auth', ()=>({resolve_api_key: mocks.resolve_api_key}));
vi.mock('../../utils/output', ()=>({
    print: mocks.print,
    print_table: mocks.print_table,
    success: mocks.success,
    info: mocks.info,
    fail: mocks.fail,
}));

import {handle_list, handle_check} from '../../commands/accounts';

describe('commands/accounts', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
        mocks.resolve_api_key.mockReturnValue('test-key');
    });

    describe('list', ()=>{
        it('shows info when no accounts', async()=>{
            mocks.get.mockResolvedValue([]);
            await handle_list('test-key', {});
            expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('No email accounts'));
        });

        it('prints table with accounts', async()=>{
            mocks.get.mockResolvedValue([
                {id: 1, senderName: 'John', emailAddress: 'john@co.com'},
                {id: 2, senderName: 'Jane', emailAddress: 'jane@co.com'},
            ]);
            await handle_list('test-key', {});
            expect(mocks.print_table).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ID: '1', 'Email Address': 'john@co.com'}),
                ]),
                ['ID', 'Sender Name', 'Email Address'],
            );
        });

        it('prints JSON when --json flag set', async()=>{
            const accounts = [{id: 1, senderName: 'John', emailAddress: 'john@co.com'}];
            mocks.get.mockResolvedValue(accounts);
            await handle_list('test-key', {json: true});
            expect(mocks.print).toHaveBeenCalledWith(accounts, {json: true});
        });
    });

    describe('check', ()=>{
        it('exits 1 when no accounts', async()=>{
            mocks.get.mockResolvedValue([]);
            const exit_spy = vi.spyOn(process, 'exit').mockImplementation(()=>{
                throw new Error('exit');
            });
            const log_spy = vi.spyOn(console, 'log').mockImplementation(()=>{});
            await expect(handle_check('test-key')).rejects.toThrow('exit');
            expect(log_spy).toHaveBeenCalledWith('NO_ACCOUNTS');
            exit_spy.mockRestore();
            log_spy.mockRestore();
        });

        it('prints count when accounts exist', async()=>{
            mocks.get.mockResolvedValue([
                {id: 1, senderName: 'John', emailAddress: 'john@co.com'},
            ]);
            const log_spy = vi.spyOn(console, 'log').mockImplementation(()=>{});
            await handle_check('test-key');
            expect(log_spy).toHaveBeenCalledWith('ACCOUNTS_FOUND:1');
            log_spy.mockRestore();
        });
    });
});
