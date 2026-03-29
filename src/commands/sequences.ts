import {Command} from 'commander';
import {get, post, patch} from '../utils/client';
import {resolve_api_key} from '../utils/auth';
import {success, info, fail, print, print_table, status_label, truncate, format_date, pc} from '../utils/output';
import type {Print_opts} from '../utils/output';

type Campaign = {
    id: number;
    name: string;
    status: number;
    emailAccounts: string[];
    peopleCount: number;
    peopleActive: number;
    peopleFinished: number;
    peoplePaused: number;
    deliveriesCount: number;
    opensCount: number;
    repliesCount: number;
    bouncesCount: number;
    optOutsCount: number;
    outOfOfficeCount: number;
    created: string;
};

type Step_template = {
    id?: number;
    subject: string;
    body: string;
    ccList?: string;
};

type Step = {
    id: number;
    number: number;
    inMinutesCount: number;
    templates: Step_template[];
};

const handle_list = async(api_key: string, print_opts: Print_opts)=>{
    const campaigns = await get<Campaign[]>(api_key, '/v1/campaigns');
    if (!campaigns || campaigns.length === 0)
    {
        info('No sequences found.');
        return;
    }
    if (print_opts.json || print_opts.pretty)
    {
        print(campaigns, print_opts);
        return;
    }
    print_table(
        campaigns.map(c=>({
            ID: String(c.id),
            Name: truncate(c.name || '—', 30),
            Status: status_label(c.status),
            People: String(c.peopleCount || 0),
            Active: String(c.peopleActive || 0),
            Delivered: String(c.deliveriesCount || 0),
            Opens: String(c.opensCount || 0),
            Replies: String(c.repliesCount || 0),
            Created: format_date(c.created),
        })),
        ['ID', 'Name', 'Status', 'People', 'Active', 'Delivered', 'Opens', 'Replies', 'Created'],
    );
    info(`\nTotal: ${campaigns.length} sequences`);
};

const handle_get = async(api_key: string, id: string, print_opts: Print_opts)=>{
    const campaigns = await get<Campaign[]>(api_key, `/v1/campaigns?id=${id}`);
    if (!campaigns || campaigns.length === 0)
    {
        info('Sequence not found.');
        return;
    }
    const c = campaigns[0];
    if (print_opts.json || print_opts.pretty)
    {
        // Also fetch steps
        const steps = await get<Step[]>(api_key, `/v2/campaigns/${id}/steps`);
        print({...c, steps}, print_opts);
        return;
    }
    console.log(`Sequence: ${pc.bold(c.name)}`);
    console.log(`  ID:         ${c.id}`);
    console.log(`  Status:     ${status_label(c.status)}`);
    console.log(`  People:     ${c.peopleCount || 0} total, ${c.peopleActive || 0} active, ${c.peopleFinished || 0} finished, ${c.peoplePaused || 0} paused`);
    console.log(`  Delivered:  ${c.deliveriesCount || 0}`);
    console.log(`  Opens:      ${c.opensCount || 0}`);
    console.log(`  Replies:    ${pc.green(String(c.repliesCount || 0))}`);
    console.log(`  Bounces:    ${c.bouncesCount || 0}`);
    console.log(`  Accounts:   ${(c.emailAccounts || []).join(', ') || '—'}`);
    console.log(`  Created:    ${format_date(c.created)}`);
    // Show steps
    const steps = await get<Step[]>(api_key, `/v2/campaigns/${id}/steps`);
    if (steps?.length)
    {
        console.log(`\n  Steps:`);
        for (const step of steps)
        {
            console.log(`\n  Step ${step.number} (ID: ${step.id}) — Delay: ${step.inMinutesCount} min`);
            for (let i = 0; i < (step.templates || []).length; i++)
            {
                const t = step.templates[i];
                const variant = step.templates.length > 1 ? ` [Variant ${i+1}]` : '';
                console.log(`    Subject${variant}: ${t.subject || '(no subject)'}`);
                console.log(`    Body${variant}: ${truncate(t.body?.replace(/<[^>]*>/g, '') || '', 100)}`);
                if (t.ccList) console.log(`    CC: ${t.ccList}`);
            }
        }
    }
};

const handle_create = async(api_key: string, print_opts: Print_opts)=>{
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin)
        chunks.push(chunk);
    const config = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    if (!config.name)
        fail('Sequence config must include "name".');
    if (!config.emailAccounts || config.emailAccounts.length === 0)
        fail('Sequence config must include "emailAccounts" array.');
    const result = await post<Campaign>(api_key, '/v2/campaigns', config);
    success(`Sequence created: "${result.name}" (ID: ${result.id})`);
    print(result, print_opts);
};

const handle_update = async(api_key: string, id: string, print_opts: Print_opts)=>{
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin)
        chunks.push(chunk);
    const config = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    const result = await patch(api_key, `/v2/campaigns/${id}`, config);
    success(`Sequence ${id} updated.`);
    print(result, print_opts);
};

const handle_clone = async(api_key: string, id: string, new_name: string, print_opts: Print_opts)=>{
    // 1. Get source campaign
    const campaigns = await get<Campaign[]>(api_key, `/v1/campaigns?id=${id}`);
    if (!campaigns || campaigns.length === 0)
        fail(`Sequence ${id} not found.`);
    const source = campaigns[0];
    // 2. Get source steps
    const source_steps = await get<Step[]>(api_key, `/v2/campaigns/${id}/steps`);
    // 3. Build new campaign payload
    const new_campaign: Record<string, unknown> = {
        name: new_name,
        emailAccounts: source.emailAccounts || [],
    };
    if (source_steps?.length)
    {
        new_campaign.steps = source_steps.map(step=>({
            number: String(step.number),
            InMinutesCount: String(step.inMinutesCount),
            templates: (step.templates || []).map(t=>({
                subject: t.subject || '',
                body: t.body || '',
                ...(t.ccList ? {CcList: t.ccList} : {}),
            })),
        }));
    }
    // 4. Create new campaign
    const result = await post<Campaign>(api_key, '/v2/campaigns', new_campaign);
    success(`Sequence cloned: "${result.name}" (ID: ${result.id})`);
    info(`Source: ${source.name} (${id}) → New: ${result.name} (${result.id})`);
    print(result, print_opts);
};

const handle_start = async(api_key: string, id: string)=>{
    const result = await post<{status: string}>(api_key, `/v2/campaigns/${id}/start`);
    success(`Sequence ${id} started. Status: ${result.status}`);
};

const handle_pause = async(api_key: string, id: string)=>{
    const result = await post<{status: string}>(api_key, `/v2/campaigns/${id}/pause`);
    success(`Sequence ${id} paused. Status: ${result.status}`);
};

const handle_archive = async(api_key: string, id: string)=>{
    await post(api_key, `/v2/campaigns/${id}/archive`);
    success(`Sequence ${id} archived.`);
};

const sequences_command = new Command('sequences')
    .description('Manage outreach sequences (campaigns)');

sequences_command
    .command('list')
    .description('List all sequences with stats')
    .addHelpText('after', '\nShows all sequences with people counts, deliveries, opens, and replies.\n\nExamples:\n  reply sequences list\n  reply sequences list --json')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_list(key, {json: opts.json, pretty: opts.pretty});
    });

sequences_command
    .command('get')
    .description('Get sequence details and email steps')
    .argument('<id>', 'Sequence ID')
    .addHelpText('after', '\nShows sequence details including all email steps and their templates.\n\nExamples:\n  reply sequences get 12345\n  reply sequences get 12345 --json')
    .action(async function(this: Command, id: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_get(key, id, {json: opts.json, pretty: opts.pretty});
    });

sequences_command
    .command('create')
    .description('Create a new sequence from stdin JSON')
    .addHelpText('after', '\nReads JSON config from stdin with name, emailAccounts, steps, and settings.\n\nExamples:\n  echo \'{"name":"My Sequence","emailAccounts":["me@co.com"],"steps":[...]}\' | reply sequences create')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_create(key, {json: opts.json, pretty: opts.pretty});
    });

sequences_command
    .command('update')
    .description('Update sequence settings from stdin JSON')
    .argument('<id>', 'Sequence ID')
    .addHelpText('after', '\nReads JSON with updated settings from stdin.\n\nExamples:\n  echo \'{"name":"New Name","settings":{"emailsCountPerDay":100}}\' | reply sequences update 12345')
    .action(async function(this: Command, id: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_update(key, id, {json: opts.json, pretty: opts.pretty});
    });

sequences_command
    .command('clone')
    .description('Clone a sequence with all its steps')
    .argument('<id>', 'Source sequence ID')
    .requiredOption('--name <name>', 'Name for the new sequence')
    .addHelpText('after', '\nDuplicates a sequence including all email steps and templates.\n\nExamples:\n  reply sequences clone 12345 --name "My Clone"')
    .action(async function(this: Command, id: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_clone(key, id, opts.name, {json: opts.json, pretty: opts.pretty});
    });

sequences_command
    .command('start')
    .description('Start a sequence (begin sending emails)')
    .argument('<id>', 'Sequence ID')
    .addHelpText('after', '\nExamples:\n  reply sequences start 12345')
    .action(async function(this: Command, id: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_start(key, id);
    });

sequences_command
    .command('pause')
    .description('Pause a sequence (stop sending emails)')
    .argument('<id>', 'Sequence ID')
    .addHelpText('after', '\nExamples:\n  reply sequences pause 12345')
    .action(async function(this: Command, id: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_pause(key, id);
    });

sequences_command
    .command('archive')
    .description('Archive a sequence (cannot be undone)')
    .argument('<id>', 'Sequence ID')
    .addHelpText('after', '\nExamples:\n  reply sequences archive 12345')
    .action(async function(this: Command, id: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_archive(key, id);
    });

export {sequences_command, handle_list, handle_get, handle_create, handle_update, handle_clone, handle_start, handle_pause, handle_archive};
