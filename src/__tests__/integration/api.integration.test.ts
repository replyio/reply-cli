import {describe, it, expect, afterAll} from 'vitest';
import {resolve_api_key} from '../../utils/auth';
import {get, post, del} from '../../utils/client';

// Skip integration tests if no API key available
let api_key: string;
try {
    api_key = resolve_api_key();
} catch {
    api_key = '';
}

const SKIP = !api_key;
const test_id = Date.now();
const test_email = `test-cli-${test_id}@example.com`;

// Track created resources for cleanup
const cleanup: {contacts: string[]; schedules: number[]} = {
    contacts: [],
    schedules: [],
};

const sleep = (ms: number)=>new Promise(r=>setTimeout(r, ms));

describe.skipIf(SKIP)('Integration: Reply.io API', ()=>{
    afterAll(async()=>{
        for (const email of cleanup.contacts)
        {
            try {
                await del(api_key, `/v1/people/?email=${encodeURIComponent(email)}`);
            } catch {}
        }
        for (const id of cleanup.schedules)
        {
            try {
                await del(api_key, `/v2/schedules/${id}`);
            } catch {}
        }
    }, 30000);

    describe('accounts', ()=>{
        it('lists email accounts', async()=>{
            const accounts = await get<Array<{id: number; emailAddress: string}>>(
                api_key, '/v1/emailAccounts');
            expect(Array.isArray(accounts)).toBe(true);
        }, 15000);
    });

    describe('schedules', ()=>{
        it('lists schedules', async()=>{
            const schedules = await get<Array<{id: number; name: string}>>(
                api_key, '/v2/schedules');
            expect(Array.isArray(schedules)).toBe(true);
        }, 15000);
    });

    describe('sequences', ()=>{
        it('lists sequences (campaigns)', async()=>{
            const campaigns = await get<Array<{id: number; name: string}>>(
                api_key, '/v1/campaigns');
            expect(Array.isArray(campaigns)).toBe(true);
        }, 15000);
    });

    describe('contacts CRUD', ()=>{
        let contact_id: number;

        it('creates a contact', async()=>{
            const result = await post<{id: number; email: string}>(
                api_key, '/v1/people', {
                    email: test_email,
                    firstName: 'Test',
                    lastName: 'CLI',
                    company: 'Test Corp',
                });
            expect(result.id).toBeDefined();
            expect(result.email).toBe(test_email);
            contact_id = result.id;
            cleanup.contacts.push(test_email);
        }, 15000);

        it('gets contact by email', async()=>{
            const result = await get<{id: number; email: string}>(
                api_key, `/v1/people?email=${encodeURIComponent(test_email)}`);
            expect(result).toBeDefined();
            expect(result.email).toBe(test_email);
        }, 15000);

        it('updates contact', async()=>{
            // Small delay to avoid rate limiting on consecutive writes
            await sleep(1000);
            const result = await post<{id: number; company: string}>(
                api_key, '/v1/people', {
                    email: test_email,
                    firstName: 'Test',
                    company: 'Updated Corp',
                });
            expect(result.company).toBe('Updated Corp');
        }, 15000);

        it('searches by email', async()=>{
            const result = await get<{id: number}>(
                api_key, `/v1/people?email=${encodeURIComponent(test_email)}`);
            expect(result.id).toBe(contact_id);
        }, 15000);

        it('deletes contact', async()=>{
            await del(api_key, `/v1/people/?email=${encodeURIComponent(test_email)}`);
            cleanup.contacts = cleanup.contacts.filter(e=>e !== test_email);
            // Verify deleted — API may return null or throw 404
            try {
                const result = await get(api_key, `/v1/people?email=${encodeURIComponent(test_email)}`);
                expect(result).toBeFalsy();
            } catch (e) {
                // 404 is expected after deletion
                expect((e as Error).message).toContain('404');
            }
        }, 15000);
    });

    describe('custom fields', ()=>{
        it('lists custom fields', async()=>{
            const fields = await get<Array<{id: number; title: string}>>(
                api_key, '/v1/custom-fields/all');
            expect(Array.isArray(fields) || fields === null).toBe(true);
        }, 15000);
    });
});
