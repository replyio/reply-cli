import fs from 'fs';
import path from 'path';
import pc from 'picocolors';

const is_tty = process.stdout.isTTY === true;

const success = (msg: string)=>console.error(pc.green(`✓ ${msg}`));
const warn    = (msg: string)=>console.error(pc.yellow(`⚠ ${msg}`));
const info    = (msg: string)=>console.error(pc.dim(msg));
const fail    = (msg: string): never=>{
    console.error(pc.red(`✗ ${msg}`));
    process.exit(1);
};

type Output_format = 'json'|'pretty'|'raw';

type Print_opts = {
    json?: boolean;
    pretty?: boolean;
    output?: string;
};

const serialize = (data: unknown, fmt: Output_format): string=>{
    if (fmt === 'pretty')
        return JSON.stringify(data, null, 2);
    if (fmt === 'json')
        return JSON.stringify(data);
    if (typeof data === 'string')
        return data;
    return JSON.stringify(data, null, 2);
};

const print = (data: unknown, opts: Print_opts = {})=>{
    let fmt: Output_format = 'raw';
    if (opts.pretty)
        fmt = 'pretty';
    else if (opts.json)
        fmt = 'json';
    if (opts.output)
    {
        const ext = path.extname(opts.output).toLowerCase();
        const file_fmt = ext === '.json' ? 'json' as Output_format : fmt;
        fs.writeFileSync(opts.output, serialize(data, file_fmt), 'utf8');
        info(`Output written to ${opts.output}`);
        return;
    }
    if (!is_tty && fmt === 'raw')
        fmt = typeof data === 'string' ? 'raw' : 'json';
    process.stdout.write(serialize(data, fmt)+'\n');
};

const print_table = (rows: Record<string, unknown>[], cols: string[])=>{
    if (!rows.length)
        return;
    const widths = cols.map(c=>
        Math.max(c.length, ...rows.map(r=>String(r[c] ?? '').length))
    );
    const divider = widths.map(w=>'-'.repeat(w)).join('-+-');
    const header  = cols.map((c, i)=>c.padEnd(widths[i])).join(' | ');
    console.log(pc.dim(header));
    console.log(pc.dim(divider));
    for (const row of rows)
    {
        const line = cols.map((c, j)=>String(row[c] ?? '').padEnd(widths[j]));
        console.log(line.join(' | '));
    }
};

const status_label = (code: number): string=>{
    switch (code) {
        case 0: return pc.yellow('New');
        case 2: return pc.green('Active');
        case 4: return pc.red('Paused');
        default: return pc.dim(`Unknown(${code})`);
    }
};

const pct = (num: number, den: number): string=>{
    if (!den) return '—';
    return (num / den * 100).toFixed(1) + '%';
};

const truncate = (str: string, max_len: number): string=>{
    if (!str) return '';
    return str.length > max_len ? str.slice(0, max_len - 1) + '…' : str;
};

const format_date = (iso: string): string=>{
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'});
};

export {
    is_tty, pc,
    success, warn, info, fail,
    print, print_table,
    status_label, pct, truncate, format_date,
};
export type {Print_opts, Output_format};
