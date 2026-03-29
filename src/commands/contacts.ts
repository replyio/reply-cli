import {Command} from 'commander';
import {get, post, del} from '../utils/client';
import {resolve_api_key} from '../utils/auth';
import {success, info, fail, print, print_table, status_label, truncate, format_date, pct, pc} from '../utils/output';
import type {Print_opts} from '../utils/output';

type Contact = {
    id: number;
    email: string;
    firstName: string;
    lastName?: string;
    company?: string;
    title?: string;
    phone?: string;
    city?: string;
    state?: string;
    country?: string;
    linkedInProfile?: string;
    addingDate: string;
    customFields?: Array<{key: string; value: string}>;
};

type People_response = {
    people: Contact[];
    total: number;
    page: number;
    limit: number;
    pagesCount: number;
};

type Contact_stats = {
    email: string;
    fullName?: string;
    isBlocked: boolean;
    isOptedOut: boolean;
    campaigns: Array<{
        name: string;
        status: number;
        personStatus: string;
        replyDate?: string;
        inboxState: string;
        emails: Array<{
            sentDate: string;
            subject: string;
            isOpened: boolean;
            isReplied: boolean;
        }>;
    }>;
};

const is_email = (v: string): boolean=>v.includes('@');

const handle_list = async(api_key: string, opts: {page?: string; limit?: string} & Print_opts)=>{
    const page = opts.page || '1';
    const limit = opts.limit || '25';
    const result = await get<People_response>(api_key, `/v1/people?page=${page}&limit=${limit}`);
    const people = result?.people || result as unknown as Contact[];
    if (!people || people.length === 0)
    {
        info('No contacts found.');
        return;
    }
    if (opts.json || opts.pretty)
    {
        print(result, opts);
        return;
    }
    print_table(
        people.map(p=>({
            ID: String(p.id),
            Email: p.email,
            Name: truncate(`${p.firstName || ''} ${p.lastName || ''}`.trim(), 25),
            Company: truncate(p.company || '—', 20),
            Title: truncate(p.title || '—', 20),
            Added: format_date(p.addingDate),
        })),
        ['ID', 'Email', 'Name', 'Company', 'Title', 'Added'],
    );
    const total = (result as People_response)?.total;
    const pages_count = (result as People_response)?.pagesCount;
    if (total)
        info(`\nShowing page ${page}/${pages_count || '?'} (${people.length} of ${total} contacts). Use --page N to paginate.`);
};

const handle_get = async(api_key: string, id_or_email: string, print_opts: Print_opts)=>{
    const endpoint = is_email(id_or_email)
        ? `/v1/people?email=${encodeURIComponent(id_or_email)}`
        : `/v1/people?id=${id_or_email}`;
    const result = await get<Contact>(api_key, endpoint);
    if (!result)
    {
        info('Contact not found.');
        return;
    }
    print(result, {...print_opts, pretty: print_opts.pretty ?? true});
};

const handle_create = async(api_key: string, opts: Record<string, string>, print_opts: Print_opts)=>{
    if (!opts.email || !opts.firstName)
        fail('Required: --email and --first-name');
    const body: Record<string, unknown> = {
        email: opts.email,
        firstName: opts.firstName,
    };
    if (opts.lastName) body.lastName = opts.lastName;
    if (opts.company) body.company = opts.company;
    if (opts.title) body.title = opts.title;
    if (opts.phone) body.phone = opts.phone;
    if (opts.linkedin) body.linkedInProfile = opts.linkedin;
    if (opts.city) body.city = opts.city;
    if (opts.state) body.state = opts.state;
    if (opts.country) body.country = opts.country;
    if (opts.custom)
    {
        body.customFields = opts.custom.split(',').map(pair=>{
            const [key, ...val_parts] = pair.split('=');
            return {key: key.trim(), value: val_parts.join('=').trim()};
        });
    }
    const result = await post<Contact>(api_key, '/v1/people', body);
    success(`Contact created/updated: ${result.firstName} ${result.lastName || ''} <${result.email}> (ID: ${result.id})`);
    if (print_opts.json || print_opts.pretty)
        print(result, print_opts);
};

const handle_update = async(api_key: string, opts: Record<string, string>, print_opts: Print_opts)=>{
    if (!opts.email)
        fail('Required: --email (used as the matching key)');
    const body: Record<string, unknown> = {email: opts.email};
    if (opts.firstName) body.firstName = opts.firstName;
    if (opts.lastName) body.lastName = opts.lastName;
    if (opts.company) body.company = opts.company;
    if (opts.title) body.title = opts.title;
    if (opts.phone) body.phone = opts.phone;
    if (opts.linkedin) body.linkedInProfile = opts.linkedin;
    if (opts.city) body.city = opts.city;
    if (opts.state) body.state = opts.state;
    if (opts.country) body.country = opts.country;
    const result = await post<Contact>(api_key, '/v1/people', body);
    success(`Contact updated: ${result.email} (ID: ${result.id})`);
    if (print_opts.json || print_opts.pretty)
        print(result, print_opts);
};

const handle_delete = async(api_key: string, id_or_email: string)=>{
    if (is_email(id_or_email))
    {
        await del(api_key, `/v1/people/?email=${encodeURIComponent(id_or_email)}`);
        success(`Deleted contact: ${id_or_email}`);
    }
    else
    {
        await del(api_key, `/v1/people/?id=${id_or_email}`);
        success(`Deleted contact ID: ${id_or_email}`);
    }
};

const handle_search = async(api_key: string, opts: {email?: string; linkedin?: string}, print_opts: Print_opts)=>{
    if (opts.email)
    {
        const result = await get<Contact>(api_key,
            `/v1/people?email=${encodeURIComponent(opts.email)}`);
        if (result)
        {
            success(`Found: ${result.firstName} ${result.lastName || ''} <${result.email}> (ID: ${result.id})`);
            print(result, print_opts);
        }
        else
            info('Contact not found.');
    }
    else if (opts.linkedin)
    {
        const result = await post<{ids: number[]}>(api_key, '/v1/people/lookup',
            {linkedin: opts.linkedin});
        if (result?.ids?.length)
            success(`Found contact IDs: ${result.ids.join(', ')}`);
        else
            info('No contacts found for that LinkedIn URL.');
    }
    else
        fail('Provide --email or --linkedin to search.');
};

const handle_mark_replied = async(api_key: string, email: string)=>{
    await post(api_key, '/v1/actions/markasreplied', {email});
    success(`Contact ${email} marked as replied in all sequences.`);
};

const handle_mark_finished = async(api_key: string, email: string)=>{
    await post(api_key, '/v1/actions/markasfinished', {email});
    success(`Contact ${email} marked as finished in all sequences.`);
};

const handle_opt_out = async(api_key: string, email: string)=>{
    await post(api_key, '/v1/actions/removepersonfromallcampaigns', {email});
    success(`Contact ${email} removed from all sequences (opted out).`);
};

const handle_stats = async(api_key: string, email: string, print_opts: Print_opts)=>{
    const encoded_email = email.replace('@', '%40');
    const result = await get<Contact_stats>(api_key, `/v1/stats/person?email=${encoded_email}`);
    if (!result)
    {
        info('Contact not found.');
        return;
    }
    if (print_opts.json || print_opts.pretty)
    {
        print(result, print_opts);
        return;
    }
    console.log(`\nContact: ${pc.bold(result.fullName || result.email)}`);
    console.log(`  Email:      ${result.email}`);
    console.log(`  Blocked:    ${result.isBlocked ? pc.red('Yes') : pc.green('No')}`);
    console.log(`  Opted out:  ${result.isOptedOut ? pc.red('Yes') : pc.green('No')}`);
    console.log();
    if (result.campaigns?.length)
    {
        print_table(
            result.campaigns.map(c=>({
                Sequence: truncate(c.name || '—', 30),
                Status: typeof c.status === 'number' ? status_label(c.status) : (c.status || '—'),
                'Person Status': c.personStatus || '—',
                'Reply Date': c.replyDate ? format_date(c.replyDate) : '—',
                Inbox: c.inboxState || '—',
            })),
            ['Sequence', 'Status', 'Person Status', 'Reply Date', 'Inbox'],
        );
        for (const c of result.campaigns)
        {
            if (c.emails?.length)
            {
                console.log(pc.bold(`\n  ${c.name} — Emails:`));
                for (const e of c.emails)
                {
                    const status = e.isOpened ? pc.green('opened') : pc.dim('not opened');
                    const reply = e.isReplied ? ` | ${pc.green('replied')}` : '';
                    console.log(`    ${pc.dim(format_date(e.sentDate))} ${pc.cyan(truncate(e.subject || '(no subject)', 50))} [${status}${reply}]`);
                }
            }
        }
    }
    else
        info('No sequence activity for this contact.');
};

const contacts_command = new Command('contacts')
    .description('Manage contacts (prospects)');

contacts_command
    .command('list')
    .description('List contacts (paginated)')
    .option('--page <n>', 'Page number (default: 1)')
    .option('--limit <n>', 'Contacts per page (default: 25)')
    .addHelpText('after', '\nExamples:\n  reply contacts list\n  reply contacts list --page 2 --limit 50')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_list(key, {page: opts.page, limit: opts.limit, json: opts.json, pretty: opts.pretty});
    });

contacts_command
    .command('get')
    .description('Get contact details by ID or email')
    .argument('<id-or-email>', 'Contact ID or email address')
    .addHelpText('after', '\nExamples:\n  reply contacts get john@example.com\n  reply contacts get 12345678')
    .action(async function(this: Command, id_or_email: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_get(key, id_or_email, {json: opts.json, pretty: opts.pretty});
    });

contacts_command
    .command('create')
    .description('Create a new contact')
    .requiredOption('--email <email>', 'Email address (required)')
    .requiredOption('--first-name <name>', 'First name (required)')
    .option('--last-name <name>', 'Last name')
    .option('--company <company>', 'Company name')
    .option('--title <title>', 'Job title')
    .option('--phone <phone>', 'Phone number')
    .option('--linkedin <url>', 'LinkedIn profile URL')
    .option('--city <city>', 'City')
    .option('--state <state>', 'State')
    .option('--country <country>', 'Country')
    .option('--custom <fields>', 'Custom fields: Key1=Val1,Key2=Val2')
    .addHelpText('after', '\nExamples:\n  reply contacts create --email john@co.com --first-name John --company Acme')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_create(key, opts, {json: opts.json, pretty: opts.pretty});
    });

contacts_command
    .command('update')
    .description('Update an existing contact (matched by email)')
    .requiredOption('--email <email>', 'Email address (matching key)')
    .option('--first-name <name>', 'First name')
    .option('--last-name <name>', 'Last name')
    .option('--company <company>', 'Company name')
    .option('--title <title>', 'Job title')
    .option('--phone <phone>', 'Phone number')
    .option('--linkedin <url>', 'LinkedIn profile URL')
    .option('--city <city>', 'City')
    .option('--state <state>', 'State')
    .option('--country <country>', 'Country')
    .addHelpText('after', '\nExamples:\n  reply contacts update --email john@co.com --company "New Corp"')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_update(key, opts, {json: opts.json, pretty: opts.pretty});
    });

contacts_command
    .command('delete')
    .description('Delete a contact by ID or email')
    .argument('<id-or-email>', 'Contact ID or email address')
    .addHelpText('after', '\nExamples:\n  reply contacts delete john@example.com\n  reply contacts delete 12345678')
    .action(async function(this: Command, id_or_email: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_delete(key, id_or_email);
    });

contacts_command
    .command('search')
    .description('Search for a contact by email or LinkedIn URL')
    .option('--email <email>', 'Search by email address')
    .option('--linkedin <url>', 'Search by LinkedIn profile URL')
    .addHelpText('after', '\nExamples:\n  reply contacts search --email john@co.com\n  reply contacts search --linkedin https://linkedin.com/in/john')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_search(key, {email: opts.email, linkedin: opts.linkedin},
            {json: opts.json, pretty: opts.pretty});
    });

contacts_command
    .command('mark-replied')
    .description('Mark a contact as replied in all sequences')
    .argument('<email>', 'Contact email address')
    .addHelpText('after', '\nExamples:\n  reply contacts mark-replied john@co.com')
    .action(async function(this: Command, email: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_mark_replied(key, email);
    });

contacts_command
    .command('mark-finished')
    .description('Mark a contact as finished in all sequences')
    .argument('<email>', 'Contact email address')
    .addHelpText('after', '\nExamples:\n  reply contacts mark-finished john@co.com')
    .action(async function(this: Command, email: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_mark_finished(key, email);
    });

contacts_command
    .command('opt-out')
    .description('Remove a contact from all sequences')
    .argument('<email>', 'Contact email address')
    .addHelpText('after', '\nExamples:\n  reply contacts opt-out john@co.com')
    .action(async function(this: Command, email: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_opt_out(key, email);
    });

contacts_command
    .command('stats')
    .description('View contact performance: sequence activity, email history')
    .argument('<email>', 'Contact email address')
    .addHelpText('after', '\nShows blocked/opted-out status, sequence memberships, and per-email open/reply tracking.\n\nExamples:\n  reply contacts stats john@co.com')
    .action(async function(this: Command, email: string) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_stats(key, email, {json: opts.json, pretty: opts.pretty});
    });

export {
    contacts_command,
    handle_list, handle_get, handle_create, handle_update,
    handle_delete, handle_search, handle_mark_replied,
    handle_mark_finished, handle_opt_out, handle_stats,
};
