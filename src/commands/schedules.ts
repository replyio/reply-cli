import {Command} from 'commander';
import {get, post, del} from '../utils/client';
import {resolve_api_key} from '../utils/auth';
import {success, info, fail, print, print_table} from '../utils/output';
import type {Print_opts} from '../utils/output';

type Time_point = {hour: number; minute: number};
type Time_range = {fromTime: Time_point; toTime: Time_point};
type Timing = {weekDay: string; isActive: boolean; timeRanges: Time_range[]};
type Schedule = {
    id: number;
    name: string;
    timezoneId: string;
    isDefault: boolean;
    mainTimings: Timing[];
};

const pad = (n: number): string=>String(n).padStart(2, '0');

const format_timings = (timings: Timing[]): string=>{
    if (!timings?.length) return '—';
    return timings
        .filter(t=>t.isActive)
        .map(t=>{
            const ranges = (t.timeRanges || [])
                .map(r=>`${pad(r.fromTime.hour)}:${pad(r.fromTime.minute)}-${pad(r.toTime.hour)}:${pad(r.toTime.minute)}`)
                .join(', ');
            return `${t.weekDay.slice(0, 3)}: ${ranges}`;
        })
        .join(' | ');
};

const handle_list = async(api_key: string, print_opts: Print_opts)=>{
    const schedules = await get<Schedule[]>(api_key, '/v2/schedules');
    if (!schedules || schedules.length === 0)
    {
        info('No schedules found.');
        return;
    }
    if (print_opts.json || print_opts.pretty)
    {
        print(schedules, print_opts);
        return;
    }
    print_table(
        schedules.map(s=>({
            ID: String(s.id),
            Name: s.name || '—',
            Timezone: s.timezoneId || '—',
            Default: s.isDefault ? 'Yes' : '',
            'Active Days': format_timings(s.mainTimings),
        })),
        ['ID', 'Name', 'Timezone', 'Default', 'Active Days'],
    );
};

const handle_get = async(api_key: string, id: string, print_opts: Print_opts)=>{
    const schedule = await get<Schedule>(api_key, `/v2/schedules/${id}`);
    print(schedule, {...print_opts, pretty: print_opts.pretty ?? true});
};

const handle_create = async(api_key: string, print_opts: Print_opts)=>{
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin)
        chunks.push(chunk);
    const config = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    if (!config.name)
        fail('Schedule config must include "name".');
    const result = await post<{id: number}>(api_key, '/v2/schedules', config);
    success(`Schedule created. ID: ${result.id}`);
    print(result, print_opts);
};

const handle_delete = async(api_key: string, id: string)=>{
    await del(api_key, `/v2/schedules/${id}`);
    success(`Schedule ${id} deleted.`);
};

const handle_set_default = async(api_key: string, id: string)=>{
    await post(api_key, `/v2/schedules/${id}/set-default`);
    success(`Schedule ${id} set as default.`);
};

const schedules_command = new Command('schedules')
    .description('Manage sending schedules');

schedules_command
    .command('list')
    .description('List all sending schedules')
    .addHelpText('after', '\nShows schedule names, timezones, and active sending windows.\n\nExamples:\n  reply schedules list\n  reply schedules list --json')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_list(key, {json: opts.json, pretty: opts.pretty});
    });

schedules_command
    .command('get')
    .description('Get schedule details by ID')
    .argument('<id>', 'Schedule ID')
    .addHelpText('after', '\nExamples:\n  reply schedules get 12345')
    .action(async function(this: Command, id: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_get(key, id, {json: opts.json, pretty: opts.pretty});
    });

schedules_command
    .command('create')
    .description('Create a new sending schedule from stdin JSON')
    .addHelpText('after', '\nReads JSON config from stdin.\n\nExamples:\n  echo \'{"name":"Business Hours","timezoneId":"Eastern Standard Time",...}\' | reply schedules create')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_create(key, {json: opts.json, pretty: opts.pretty});
    });

schedules_command
    .command('delete')
    .description('Delete a schedule by ID')
    .argument('<id>', 'Schedule ID')
    .addHelpText('after', '\nExamples:\n  reply schedules delete 12345')
    .action(async function(this: Command, id: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_delete(key, id);
    });

schedules_command
    .command('set-default')
    .description('Set a schedule as the default')
    .argument('<id>', 'Schedule ID')
    .addHelpText('after', '\nExamples:\n  reply schedules set-default 12345')
    .action(async function(this: Command, id: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_set_default(key, id);
    });

export {schedules_command, handle_list, handle_get, handle_create, handle_delete, handle_set_default};
