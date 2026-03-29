import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mocks = vi.hoisted(()=>({
    get: vi.fn(),
    post_form_data: vi.fn(),
    resolve_api_key: vi.fn(),
    print: vi.fn(),
    print_table: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    fail: vi.fn((msg: string): never=>{ throw new Error(`fail:${msg}`); }),
}));

vi.mock('../../utils/client', ()=>({get: mocks.get, post_form_data: mocks.post_form_data}));
vi.mock('../../utils/auth', ()=>({resolve_api_key: mocks.resolve_api_key}));
vi.mock('../../utils/output', ()=>({
    print: mocks.print, print_table: mocks.print_table, success: mocks.success,
    info: mocks.info, fail: mocks.fail,
}));

import {handle_preview, handle_upload} from '../../commands/import';

describe('commands/import', ()=>{
    let tmp_dir: string;
    let csv_path: string;

    beforeEach(()=>{
        vi.clearAllMocks();
        tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reply-cli-csv-'));
        csv_path = path.join(tmp_dir, 'test.csv');
        fs.writeFileSync(csv_path, 'Email,First Name,Company\njohn@co.com,John,Acme\njane@co.com,Jane,Corp\n');
    });

    afterEach(()=>{
        fs.rmSync(tmp_dir, {recursive: true, force: true});
    });

    describe('preview', ()=>{
        it('fails for missing file', async()=>{
            await expect(handle_preview('key', '/nonexistent.csv', {}))
                .rejects.toThrow('fail:');
        });

        it('shows CSV headers and sample data', async()=>{
            mocks.get.mockResolvedValue([]);
            const log_spy = vi.spyOn(console, 'log').mockImplementation(()=>{});
            await handle_preview('key', csv_path, {});
            expect(mocks.print_table).toHaveBeenCalled();
            expect(log_spy).toHaveBeenCalledWith(expect.stringContaining('Total rows: 2'));
            log_spy.mockRestore();
        });

        it('returns JSON with --json', async()=>{
            mocks.get.mockResolvedValue([]);
            await handle_preview('key', csv_path, {json: true});
            expect(mocks.print).toHaveBeenCalledWith(
                expect.objectContaining({
                    headers: ['Email', 'First Name', 'Company'],
                    totalRows: 2,
                }),
                {json: true},
            );
        });
    });

    describe('upload', ()=>{
        it('fails for missing file', async()=>{
            await expect(handle_upload('key', '/nonexistent.csv', '{}'))
                .rejects.toThrow('fail:');
        });

        it('uploads CSV with mapping', async()=>{
            mocks.post_form_data.mockResolvedValue({importSessionId: 'abc-123'});
            await handle_upload('key', csv_path, '{"email":"Email","firstName":"First Name"}');
            expect(mocks.post_form_data).toHaveBeenCalledWith(
                'key',
                '/v1/people/import/schedules-embedded',
                expect.any(FormData),
            );
            expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('abc-123'));
        });
    });
});
