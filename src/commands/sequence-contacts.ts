import {Command} from 'commander';
import {post} from '../utils/client';
import {resolve_api_key} from '../utils/auth';
import {success, info, fail} from '../utils/output';

const handle_add = async(api_key: string, contact: string, sequence_id: string, force?: boolean)=>{
    const body: Record<string, unknown> = {
        campaignId: parseInt(sequence_id),
        email: contact,
    };
    if (force) body.forcePush = true;
    await post(api_key, '/v1/actions/pushtocampaign', body);
    success(`Pushed ${contact} to sequence ${sequence_id}${force ? ' (force)' : ''}`);
};

const handle_add_new = async(api_key: string, opts: Record<string, string>)=>{
    if (!opts.contact || !opts.sequence || !opts.firstName)
        fail('Required: --contact, --first-name, and --sequence');
    const body: Record<string, unknown> = {
        campaignId: parseInt(opts.sequence),
        email: opts.contact,
        firstName: opts.firstName,
    };
    if (opts.lastName) body.lastName = opts.lastName;
    if (opts.company) body.company = opts.company;
    if (opts.title) body.title = opts.title;
    if (opts.custom)
    {
        body.customFields = opts.custom.split(',').map(pair=>{
            const [key, ...val_parts] = pair.split('=');
            return {key: key.trim(), value: val_parts.join('=').trim()};
        });
    }
    await post(api_key, '/v1/actions/addandpushtocampaign', body);
    success(`Created and pushed ${opts.contact} to sequence ${opts.sequence}`);
};

const handle_add_bulk = async(api_key: string, contacts: string, sequence_id: string, overwrite?: boolean)=>{
    const contact_ids = contacts.split(',').map(id=>parseInt(id.trim()));
    const body = {
        ContactIds: contact_ids,
        SequenceId: parseInt(sequence_id),
        OverwriteExisting: overwrite || false,
    };
    const result = await post<{
        affectedIdList?: number[];
        skippedByOwner?: number;
        skippedByInvalidEmail?: number;
        skippedByOptedOutStatus?: number;
        skipped?: number;
    }>(api_key, '/v1/Actions/pushContactsToSequence', body);
    success('Bulk push complete.');
    if (result?.affectedIdList)
        info(`Pushed: ${result.affectedIdList.length} contacts`);
    if (result?.skippedByOwner) info(`Skipped (owner): ${result.skippedByOwner}`);
    if (result?.skippedByInvalidEmail) info(`Skipped (invalid email): ${result.skippedByInvalidEmail}`);
    if (result?.skippedByOptedOutStatus) info(`Skipped (opted out): ${result.skippedByOptedOutStatus}`);
    if (result?.skipped) info(`Skipped (other): ${result.skipped}`);
};

const handle_remove = async(api_key: string, contact: string, sequence_id: string)=>{
    await post(api_key, '/v1/actions/removepersonfromcampaignbyid', {
        campaignId: parseInt(sequence_id),
        email: contact,
    });
    success(`Removed ${contact} from sequence ${sequence_id}`);
};

const handle_remove_all = async(api_key: string, contact: string)=>{
    await post(api_key, '/v1/actions/removepersonfromallcampaigns', {email: contact});
    success(`Removed ${contact} from all sequences`);
};

const sequence_contacts_command = new Command('sequence-contacts')
    .description('Add or remove contacts from sequences');

sequence_contacts_command
    .command('add')
    .description('Add an existing contact to a sequence')
    .requiredOption('--contact <email>', 'Contact email address')
    .requiredOption('--sequence <id>', 'Sequence ID')
    .option('--force', 'Force push even if contact is in another sequence')
    .addHelpText('after', '\nPushes an existing contact into a sequence. Use --force to move from another active sequence.\n\nExamples:\n  reply sequence-contacts add --contact john@co.com --sequence 12345\n  reply sequence-contacts add --contact john@co.com --sequence 12345 --force')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_add(key, opts.contact, opts.sequence, opts.force);
    });

sequence_contacts_command
    .command('add-new')
    .description('Create a new contact and add to a sequence in one step')
    .requiredOption('--contact <email>', 'Contact email address')
    .requiredOption('--first-name <name>', 'First name')
    .requiredOption('--sequence <id>', 'Sequence ID')
    .option('--last-name <name>', 'Last name')
    .option('--company <company>', 'Company name')
    .option('--title <title>', 'Job title')
    .option('--custom <fields>', 'Custom fields: Key1=Val1,Key2=Val2')
    .addHelpText('after', '\nCreates a contact and enrolls them in a sequence in one API call.\n\nExamples:\n  reply sequence-contacts add-new --contact john@co.com --first-name John --sequence 12345')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_add_new(key, opts);
    });

sequence_contacts_command
    .command('add-bulk')
    .description('Add multiple contacts to a sequence by contact IDs')
    .requiredOption('--contacts <ids>', 'Comma-separated contact IDs')
    .requiredOption('--sequence <id>', 'Sequence ID')
    .option('--overwrite', 'Force push contacts already in other sequences')
    .addHelpText('after', '\nBulk enrolls contacts by their Reply.io IDs.\n\nExamples:\n  reply sequence-contacts add-bulk --contacts 111,222,333 --sequence 12345')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_add_bulk(key, opts.contacts, opts.sequence, opts.overwrite);
    });

sequence_contacts_command
    .command('remove')
    .description('Remove a contact from a specific sequence')
    .requiredOption('--contact <email>', 'Contact email address')
    .requiredOption('--sequence <id>', 'Sequence ID')
    .addHelpText('after', '\nExamples:\n  reply sequence-contacts remove --contact john@co.com --sequence 12345')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_remove(key, opts.contact, opts.sequence);
    });

sequence_contacts_command
    .command('remove-all')
    .description('Remove a contact from all sequences')
    .requiredOption('--contact <email>', 'Contact email address')
    .addHelpText('after', '\nExamples:\n  reply sequence-contacts remove-all --contact john@co.com')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_remove_all(key, opts.contact);
    });

export {
    sequence_contacts_command,
    handle_add, handle_add_new, handle_add_bulk,
    handle_remove, handle_remove_all,
};
