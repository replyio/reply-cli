import fs from 'fs';
import path from 'path';

const resolve_api_key = (cli_key?: string): string=>{
    if (cli_key)
        return cli_key;
    if (process.env.REPLY_API_KEY)
        return process.env.REPLY_API_KEY;
    // Walk up from cwd to find .env
    let dir = process.cwd();
    for (let i = 0; i < 5; i++)
    {
        const env_path = path.join(dir, '.env');
        if (fs.existsSync(env_path))
        {
            const content = fs.readFileSync(env_path, 'utf-8');
            const match = content.match(/REPLY_API_KEY=(.+)/);
            if (match)
                return match[1].trim();
        }
        const parent = path.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    throw new Error(
        'REPLY_API_KEY not found.\n'
        +'  Set it via: --api-key flag, REPLY_API_KEY env var, or .env file.'
    );
};

export {resolve_api_key};
