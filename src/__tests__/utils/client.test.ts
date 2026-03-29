import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

// Mock global fetch
const mock_fetch = vi.fn();
vi.stubGlobal('fetch', mock_fetch);

import {get, post, patch, del} from '../../utils/client';

const json_response = (data: unknown, status = 200)=>
    new Response(JSON.stringify(data), {
        status,
        headers: {'Content-Type': 'application/json'},
    });

const error_response = (status: number, body = '')=>
    new Response(body, {status});

describe('utils/client', ()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
    });

    it('get sends GET with x-api-key header', async()=>{
        mock_fetch.mockResolvedValue(json_response({ok: true}));
        const result = await get('test-key', '/v1/test');
        expect(mock_fetch).toHaveBeenCalledWith(
            'https://api.reply.io/v1/test',
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({'x-api-key': 'test-key'}),
            }),
        );
        expect(result).toEqual({ok: true});
    });

    it('post sends POST with JSON body', async()=>{
        mock_fetch.mockResolvedValue(json_response({id: 1}));
        const result = await post('test-key', '/v1/people', {email: 'a@b.com'});
        expect(mock_fetch).toHaveBeenCalledWith(
            'https://api.reply.io/v1/people',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({email: 'a@b.com'}),
            }),
        );
        expect(result).toEqual({id: 1});
    });

    it('patch sends PATCH', async()=>{
        mock_fetch.mockResolvedValue(json_response({updated: true}));
        await patch('test-key', '/v2/campaigns/1', {name: 'New'});
        expect(mock_fetch).toHaveBeenCalledWith(
            'https://api.reply.io/v2/campaigns/1',
            expect.objectContaining({method: 'PATCH'}),
        );
    });

    it('del sends DELETE', async()=>{
        mock_fetch.mockResolvedValue(new Response('', {status: 200}));
        await del('test-key', '/v1/people/?id=1');
        expect(mock_fetch).toHaveBeenCalledWith(
            'https://api.reply.io/v1/people/?id=1',
            expect.objectContaining({method: 'DELETE'}),
        );
    });

    it('returns null for empty response body', async()=>{
        mock_fetch.mockResolvedValue(new Response('', {status: 200}));
        const result = await get('test-key', '/v1/test');
        expect(result).toBeNull();
    });

    it('returns text for non-JSON response', async()=>{
        mock_fetch.mockResolvedValue(new Response('plain text', {status: 200}));
        const result = await get('test-key', '/v1/test');
        expect(result).toBe('plain text');
    });

    it('throws on 401 with hint', async()=>{
        mock_fetch.mockResolvedValue(error_response(401, 'Unauthorized'));
        await expect(get('bad-key', '/v1/test')).rejects.toThrow('Invalid API key');
    });

    it('throws on 404 with hint', async()=>{
        mock_fetch.mockResolvedValue(error_response(404, 'Not found'));
        await expect(get('test-key', '/v1/missing')).rejects.toThrow('not found');
    });

    it('retries on 429 then succeeds', async()=>{
        mock_fetch
            .mockResolvedValueOnce(error_response(429))
            .mockResolvedValueOnce(json_response({ok: true}));
        const result = await get('test-key', '/v1/test');
        expect(result).toEqual({ok: true});
        expect(mock_fetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 500 and eventually throws', async()=>{
        mock_fetch.mockResolvedValue(error_response(500, 'Server Error'));
        await expect(get('test-key', '/v1/test')).rejects.toThrow('Server Error');
        expect(mock_fetch).toHaveBeenCalledTimes(4); // 1 + 3 retries
    });
});
