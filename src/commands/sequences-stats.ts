import {Command} from 'commander';
import {get} from '../utils/client';
import {resolve_api_key} from '../utils/auth';
import {info, print, print_table, status_label, truncate, pct, pc} from '../utils/output';
import type {Print_opts} from '../utils/output';

type Campaign = {
    id: number;
    name: string;
    status: number;
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
};

type Step = {
    id: number;
    number: number;
    inMinutesCount: number;
};

type Step_stats = {
    stepNumber: number;
    peopleSentTo: number;
    openedPeople: number;
    repliedPeople: number;
    bouncedPeople: number;
    clickedPeople: number;
};

type Click_stats = {
    stepClicks: Array<{
        stepId: number;
        links: Array<{
            textToDisplay?: string;
            url?: string;
            clicks: number;
        }>;
    }>;
};

const handle_stats = async(api_key: string, id: string, print_opts: Print_opts)=>{
    const result = await get<Campaign | Campaign[]>(api_key, `/v1/campaigns?id=${id}`);
    const c = Array.isArray(result) ? result[0] : result;
    if (!c || !c.name)
    {
        info('Sequence not found.');
        return;
    }
    if (print_opts.json || print_opts.pretty)
    {
        const steps = await get<Step[]>(api_key, `/v2/campaigns/${id}/steps`);
        const step_stats = [];
        for (const step of (steps || []))
        {
            try {
                const ss = await get<Step_stats>(api_key,
                    `/v1/Stats/CampaignStep?campaignId=${id}&stepId=${step.id}`);
                step_stats.push(ss);
            } catch {
                step_stats.push({stepNumber: step.number, error: 'unavailable'});
            }
        }
        print({campaign: c, stepStats: step_stats}, print_opts);
        return;
    }
    // Campaign summary
    console.log(`\nSequence: ${pc.bold(c.name)}`);
    console.log(`  Status:       ${status_label(c.status)}`);
    console.log(`  People:       ${c.peopleCount || 0} total, ${c.peopleActive || 0} active, ${c.peopleFinished || 0} finished, ${c.peoplePaused || 0} paused`);
    console.log(`  Delivered:    ${pc.bold(String(c.deliveriesCount || 0))}`);
    console.log(`  Opens:        ${c.opensCount || 0} ${pc.dim('(' + pct(c.opensCount, c.deliveriesCount) + ')')}`);
    console.log(`  Replies:      ${pc.green(String(c.repliesCount || 0))} ${pc.dim('(' + pct(c.repliesCount, c.deliveriesCount) + ')')}`);
    console.log(`  Bounces:      ${c.bouncesCount || 0} ${pc.dim('(' + pct(c.bouncesCount, c.deliveriesCount) + ')')}`);
    console.log(`  Opt-outs:     ${c.optOutsCount || 0}`);
    console.log(`  Out of office: ${c.outOfOfficeCount || 0}`);
    console.log();
    // Per-step stats
    const steps = await get<Step[]>(api_key, `/v2/campaigns/${id}/steps`);
    if (steps?.length)
    {
        const rows: Record<string, string>[] = [];
        for (const step of steps)
        {
            try {
                const ss = await get<Step_stats>(api_key,
                    `/v1/Stats/CampaignStep?campaignId=${id}&stepId=${step.id}`);
                rows.push({
                    Step: String(ss.stepNumber || step.number),
                    Sent: String(ss.peopleSentTo || 0),
                    Opened: String(ss.openedPeople || 0),
                    'Open%': pct(ss.openedPeople, ss.peopleSentTo),
                    Replied: String(ss.repliedPeople || 0),
                    'Reply%': pct(ss.repliedPeople, ss.peopleSentTo),
                    Bounced: String(ss.bouncedPeople || 0),
                    Clicked: String(ss.clickedPeople || 0),
                });
            } catch {
                rows.push({Step: String(step.number), Sent: '—', Opened: '—',
                    'Open%': '—', Replied: '—', 'Reply%': '—', Bounced: '—', Clicked: '—'});
            }
        }
        print_table(rows, ['Step', 'Sent', 'Opened', 'Open%', 'Replied', 'Reply%', 'Bounced', 'Clicked']);
    }
    // Click stats
    try {
        const clicks = await get<Click_stats>(api_key, `/v1/Stats/CampaignClicks?campaignId=${id}`);
        if (clicks?.stepClicks?.length)
        {
            console.log(pc.bold('\nClick Details:'));
            for (const sc of clicks.stepClicks)
            {
                for (const link of sc.links || [])
                    console.log(`  ${pc.cyan(link.url || link.textToDisplay || 'Link')} — ${link.clicks} clicks`);
            }
        }
    } catch {}
};

const handle_top = async(api_key: string, print_opts: Print_opts)=>{
    const campaigns = await get<Campaign[]>(api_key, '/v1/campaigns');
    if (!campaigns || campaigns.length === 0)
    {
        info('No sequences found.');
        return;
    }
    const with_deliveries = campaigns
        .filter(c=>(c.deliveriesCount || 0) > 0)
        .map(c=>({
            ...c,
            replyRate: (c.repliesCount || 0) / c.deliveriesCount,
            openRate: (c.opensCount || 0) / c.deliveriesCount,
        }))
        .sort((a, b)=>b.replyRate - a.replyRate)
        .slice(0, 3);
    if (with_deliveries.length === 0)
    {
        info('No sequences with deliveries yet.');
        return;
    }
    if (print_opts.json || print_opts.pretty)
    {
        print(with_deliveries, print_opts);
        return;
    }
    print_table(
        with_deliveries.map((c, i)=>({
            Rank: String(i + 1),
            Name: truncate(c.name || '—', 30),
            Status: status_label(c.status),
            Delivered: String(c.deliveriesCount),
            Opens: `${c.opensCount} (${pct(c.opensCount, c.deliveriesCount)})`,
            Replies: `${c.repliesCount} (${pct(c.repliesCount, c.deliveriesCount)})`,
            'Reply Rate': pc.green(pct(c.repliesCount, c.deliveriesCount)),
        })),
        ['Rank', 'Name', 'Status', 'Delivered', 'Opens', 'Replies', 'Reply Rate'],
    );
};

const handle_summary = async(api_key: string, print_opts: Print_opts)=>{
    const campaigns = await get<Campaign[]>(api_key, '/v1/campaigns');
    if (!campaigns || campaigns.length === 0)
    {
        info('No sequences found.');
        return;
    }
    const active = campaigns.filter(c=>c.status === 2).length;
    const paused = campaigns.filter(c=>c.status === 4).length;
    const new_c = campaigns.filter(c=>c.status === 0).length;
    let total_people = 0, total_delivered = 0, total_opens = 0,
        total_replies = 0, total_bounces = 0, total_optouts = 0;
    let best = {name: '—', replyRate: 0};
    for (const c of campaigns)
    {
        total_people += c.peopleCount || 0;
        total_delivered += c.deliveriesCount || 0;
        total_opens += c.opensCount || 0;
        total_replies += c.repliesCount || 0;
        total_bounces += c.bouncesCount || 0;
        total_optouts += c.optOutsCount || 0;
        const rr = (c.deliveriesCount || 0) > 0
            ? (c.repliesCount || 0) / c.deliveriesCount : 0;
        if (rr > best.replyRate)
            best = {name: c.name, replyRate: rr};
    }
    if (print_opts.json || print_opts.pretty)
    {
        print({
            sequences: {total: campaigns.length, active, paused, new: new_c},
            performance: {total_people, total_delivered, total_opens, total_replies, total_bounces, total_optouts},
            best_sequence: best.replyRate > 0 ? best : null,
        }, print_opts);
        return;
    }
    console.log(pc.bold('\n  Sequences'));
    console.log(`    Total: ${campaigns.length}  |  ${pc.green(active + ' active')}  |  ${pc.yellow(paused + ' paused')}  |  ${new_c} new`);
    console.log();
    console.log(pc.bold('  Aggregate Performance'));
    console.log(`    Total contacts:  ${total_people}`);
    console.log(`    Delivered:       ${total_delivered}`);
    console.log(`    Opens:           ${total_opens} (${pct(total_opens, total_delivered)})`);
    console.log(`    Replies:         ${pc.green(String(total_replies))} (${pct(total_replies, total_delivered)})`);
    console.log(`    Bounces:         ${total_bounces} (${pct(total_bounces, total_delivered)})`);
    console.log(`    Opt-outs:        ${total_optouts}`);
    console.log();
    if (best.replyRate > 0)
    {
        console.log(pc.bold('  Best Sequence'));
        console.log(`    ${pc.cyan(best.name)} — ${pc.green((best.replyRate * 100).toFixed(1) + '% reply rate')}`);
    }
};

const sequences_stats_command = new Command('stats')
    .description('View sequence performance statistics')
    .argument('[id]', 'Sequence ID (omit for --top or --summary)')
    .option('--top', 'Show top 3 performing sequences by reply rate')
    .option('--summary', 'Show aggregate performance across all sequences')
    .addHelpText('after', '\nShows detailed per-step stats for a sequence, or aggregate stats.\n\nExamples:\n  reply sequences stats 12345          # Detailed stats for sequence\n  reply sequences stats --top           # Top 3 by reply rate\n  reply sequences stats --summary       # Aggregate account performance')
    .action(async function(this: Command, id: string | undefined) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        const print_opts: Print_opts = {json: opts.json, pretty: opts.pretty};
        if (opts.top)
            return handle_top(key, print_opts);
        if (opts.summary)
            return handle_summary(key, print_opts);
        if (!id)
        {
            console.error('Provide a sequence ID, or use --top or --summary.');
            process.exit(1);
        }
        await handle_stats(key, id, print_opts);
    });

export {sequences_stats_command, handle_stats, handle_top, handle_summary};
