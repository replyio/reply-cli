import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {resolve_api_key} from '../../utils/auth';

describe('utils/auth', ()=>{
    const original_env = process.env.REPLY_API_KEY;
    const original_cwd = process.cwd();
    let tmp_dir: string;

    beforeEach(()=>{
        delete process.env.REPLY_API_KEY;
        tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reply-cli-test-'));
        process.chdir(tmp_dir);
    });

    afterEach(()=>{
        process.chdir(original_cwd);
        if (original_env)
            process.env.REPLY_API_KEY = original_env;
        else
            delete process.env.REPLY_API_KEY;
        fs.rmSync(tmp_dir, {recursive: true, force: true});
    });

    it('returns cli key when provided', ()=>{
        expect(resolve_api_key('cli-key-123')).toBe('cli-key-123');
    });

    it('returns env var when set', ()=>{
        process.env.REPLY_API_KEY = 'env-key-456';
        expect(resolve_api_key()).toBe('env-key-456');
    });

    it('cli key takes precedence over env var', ()=>{
        process.env.REPLY_API_KEY = 'env-key-456';
        expect(resolve_api_key('cli-key-123')).toBe('cli-key-123');
    });

    it('reads from .env file in current directory', ()=>{
        fs.writeFileSync(path.join(tmp_dir, '.env'), 'REPLY_API_KEY=dotenv-key-789\n');
        expect(resolve_api_key()).toBe('dotenv-key-789');
    });

    it('reads from .env file in parent directory', ()=>{
        const sub_dir = path.join(tmp_dir, 'subdir');
        fs.mkdirSync(sub_dir);
        fs.writeFileSync(path.join(tmp_dir, '.env'), 'REPLY_API_KEY=parent-key\n');
        process.chdir(sub_dir);
        expect(resolve_api_key()).toBe('parent-key');
    });

    it('throws when no key found', ()=>{
        expect(()=>resolve_api_key()).toThrow('REPLY_API_KEY not found');
    });

    it('trims whitespace from .env value', ()=>{
        fs.writeFileSync(path.join(tmp_dir, '.env'), 'REPLY_API_KEY=  spaced-key  \n');
        expect(resolve_api_key()).toBe('spaced-key');
    });
});
