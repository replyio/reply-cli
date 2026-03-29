const BASE_URL = 'https://api.reply.io';
const TRANSIENT_STATUSES = [429, 500, 502, 503, 504];
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

const ERROR_HINTS: Record<number, string> = {
    400: 'Bad request. Check the request body and parameters.',
    401: 'Invalid API key. Check REPLY_API_KEY or pass --api-key.',
    403: 'Access denied. May require owner/master API key.',
    404: 'Resource not found. It may have been deleted.',
    429: 'Rate limit exceeded. Wait a moment and try again.',
};

type Request_opts = {
    timing?: boolean;
};

const sleep = (ms: number)=>new Promise(resolve=>setTimeout(resolve, ms));

const request = async<T = unknown>(
    api_key: string,
    method: string,
    endpoint: string,
    body?: unknown,
    opts: Request_opts = {},
): Promise<T>=>{
    const url = `${BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
        'x-api-key': api_key,
        'Content-Type': 'application/json',
    };
    const fetch_opts: RequestInit = {method, headers};
    if (body !== undefined)
        fetch_opts.body = JSON.stringify(body);
    let attempt = 0;
    const start = opts.timing ? Date.now() : 0;
    while (attempt <= MAX_RETRIES)
    {
        try {
            const res = await fetch(url, fetch_opts);
            if (opts.timing)
                console.error(`Timing: ${Date.now()-start}ms (attempt ${attempt+1})`);
            if (res.ok)
            {
                const text = await res.text();
                if (!text)
                    return null as T;
                try {
                    return JSON.parse(text) as T;
                } catch {
                    return text as unknown as T;
                }
            }
            if (TRANSIENT_STATUSES.includes(res.status) && attempt < MAX_RETRIES)
            {
                await sleep(RETRY_BASE_MS * 2**attempt);
                attempt++;
                continue;
            }
            let detail = `HTTP ${res.status}`;
            try {
                const err_body = await res.text();
                if (err_body)
                    detail = err_body;
            } catch {}
            const hint = ERROR_HINTS[res.status];
            const msg = [`Error: ${detail}`, `  Status: ${res.status}`];
            if (hint)
                msg.push(`  Hint: ${hint}`);
            throw new Error(msg.join('\n'));
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('Error:'))
                throw e;
            if (attempt < MAX_RETRIES)
            {
                await sleep(RETRY_BASE_MS * 2**attempt);
                attempt++;
                continue;
            }
            const err = e as Error;
            throw new Error(
                `Error: Network request failed — ${err.message}\n`
                +'  Check your internet connection and try again.'
            );
        }
    }
    throw new Error('Error: Max retries exceeded.');
};

const get = <T = unknown>(
    api_key: string, endpoint: string, opts?: Request_opts
): Promise<T>=>request<T>(api_key, 'GET', endpoint, undefined, opts);

const post = <T = unknown>(
    api_key: string, endpoint: string, body?: unknown, opts?: Request_opts
): Promise<T>=>request<T>(api_key, 'POST', endpoint, body, opts);

const patch = <T = unknown>(
    api_key: string, endpoint: string, body: unknown, opts?: Request_opts
): Promise<T>=>request<T>(api_key, 'PATCH', endpoint, body, opts);

const del = <T = unknown>(
    api_key: string, endpoint: string, body?: unknown, opts?: Request_opts
): Promise<T>=>request<T>(api_key, 'DELETE', endpoint, body, opts);

const post_form_data = async<T = unknown>(
    api_key: string, endpoint: string, form_data: FormData, opts: Request_opts = {},
): Promise<T>=>{
    const url = `${BASE_URL}${endpoint}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {'x-api-key': api_key},
        body: form_data,
    });
    if (opts.timing)
        console.error(`Timing: form upload complete`);
    if (res.ok)
    {
        const text = await res.text();
        if (!text)
            return null as T;
        try {
            return JSON.parse(text) as T;
        } catch {
            return text as unknown as T;
        }
    }
    let detail = `HTTP ${res.status}`;
    try {
        const err_body = await res.text();
        if (err_body)
            detail = err_body;
    } catch {}
    const hint = ERROR_HINTS[res.status];
    const msg = [`Error: ${detail}`, `  Status: ${res.status}`];
    if (hint)
        msg.push(`  Hint: ${hint}`);
    throw new Error(msg.join('\n'));
};

export {get, post, patch, del, post_form_data, request};
export type {Request_opts};
