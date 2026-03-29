#!/usr/bin/env node
import {Command} from 'commander';
import {sequences_command} from './commands/sequences';
import {sequences_stats_command} from './commands/sequences-stats';
import {sequence_contacts_command} from './commands/sequence-contacts';
import {contacts_command} from './commands/contacts';
import {accounts_command} from './commands/accounts';
import {schedules_command} from './commands/schedules';
import {import_command} from './commands/import';

const build_program = ()=>{
    const program = new Command();
    program
        .name('reply')
        .description(
            'Command-line interface for Reply.io. Manage sequences, contacts,\n'
            +'email accounts, and schedules from your terminal.'
        )
        .version('0.1.0', '-v, --version')
        .option('-k, --api-key <key>', 'Reply.io API key (overrides env/config)')
        .option('--timing', 'Show request timing')
        .option('--json', 'Output as compact JSON')
        .option('--pretty', 'Output as formatted JSON');

    // Add stats as a subcommand of sequences
    sequences_command.addCommand(sequences_stats_command);

    program.addCommand(sequences_command);
    program.addCommand(sequence_contacts_command);
    program.addCommand(contacts_command);
    program.addCommand(accounts_command);
    program.addCommand(schedules_command);
    program.addCommand(import_command);

    program.addHelpText('after', `
Command Groups:
  sequences           Manage outreach sequences (list, get, create, clone, start, pause, archive)
  sequences stats     View sequence performance (per-step stats, top performers, summary)
  sequence-contacts   Add/remove contacts from sequences (add, add-new, add-bulk, remove)
  contacts            Manage contacts (list, get, create, update, delete, search, lifecycle)
  accounts            Manage email accounts (list, check)
  schedules           Manage sending schedules (list, get, create, delete, set-default)
  import              Import contacts from CSV (preview, upload)

Authentication:
  Set REPLY_API_KEY in your .env file, environment, or pass --api-key flag.

Examples:
  reply sequences list
  reply contacts create --email john@co.com --first-name John
  reply sequence-contacts add --contact john@co.com --sequence 12345
  reply sequences stats 12345
  reply sequences stats --summary
`);

    return program;
};

const main = async()=>{
    build_program().parse(process.argv);
};

void main().catch(error=>{
    console.error(error);
    process.exit(1);
});

export {build_program};
