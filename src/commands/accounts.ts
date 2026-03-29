import {Command} from 'commander';
import {get, post} from '../utils/client';
import {resolve_api_key} from '../utils/auth';
import {success, info, fail, print, print_table} from '../utils/output';
import type {Print_opts} from '../utils/output';

type Account = {
    id: number;
    senderName: string;
    emailAddress: string;
};

const handle_list = async(api_key: string, print_opts: Print_opts)=>{
    const accounts = await get<Account[]>(api_key, '/v1/emailAccounts');
    if (!accounts || accounts.length === 0)
    {
        info('No email accounts connected.');
        info('Connect an email account at:');
        info('  https://run.reply.io/Dashboard/Material#/settings/email-accounts');
        return;
    }
    if (print_opts.json || print_opts.pretty)
    {
        print(accounts, print_opts);
        return;
    }
    print_table(
        accounts.map(a=>({
            ID: String(a.id),
            'Sender Name': a.senderName || '—',
            'Email Address': a.emailAddress,
        })),
        ['ID', 'Sender Name', 'Email Address'],
    );
};

const handle_check = async(api_key: string)=>{
    const accounts = await get<Account[]>(api_key, '/v1/emailAccounts');
    if (!accounts || accounts.length === 0)
    {
        console.log('NO_ACCOUNTS');
        process.exit(1);
    }
    console.log(`ACCOUNTS_FOUND:${accounts.length}`);
    console.log(JSON.stringify(accounts.map(a=>({
        id: a.id,
        senderName: a.senderName,
        emailAddress: a.emailAddress,
    }))));
};

const accounts_command = new Command('accounts')
    .description('Manage connected email accounts');

accounts_command
    .command('list')
    .description('List all connected email accounts')
    .addHelpText('after', '\nExamples:\n  reply accounts list\n  reply accounts list --json')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_list(key, {json: opts.json, pretty: opts.pretty});
    });

accounts_command
    .command('check')
    .description('Check if any email accounts are connected (machine-readable)')
    .addHelpText('after', '\nOutputs ACCOUNTS_FOUND:<count> or NO_ACCOUNTS (exit 1).\n\nExamples:\n  reply accounts check')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_check(key);
    });

export {accounts_command, handle_list, handle_check};
