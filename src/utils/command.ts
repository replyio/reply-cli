import {Command} from 'commander';
import {resolve_api_key} from './auth';

type Global_opts = {
    apiKey?: string;
    timing?: boolean;
    json?: boolean;
    pretty?: boolean;
};

const get_global_opts = (cmd: Command): Global_opts=>{
    const root = cmd.optsWithGlobals();
    return {
        apiKey: root.apiKey,
        timing: root.timing,
        json: root.json,
        pretty: root.pretty,
    };
};

const get_key = (cmd: Command): string=>{
    const opts = get_global_opts(cmd);
    return resolve_api_key(opts.apiKey);
};

export {get_global_opts, get_key};
export type {Global_opts};
