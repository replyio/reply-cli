import {Command} from 'commander';
import fs from 'fs';
import {get, post_form_data} from '../utils/client';
import {resolve_api_key} from '../utils/auth';
import {success, info, fail, print, print_table} from '../utils/output';
import type {Print_opts} from '../utils/output';

const REPLY_FIELDS = [
    'email', 'firstName', 'lastName', 'company', 'title', 'phone',
    'city', 'state', 'country', 'linkedInProfile', 'companySize', 'industry',
    'timeZoneId',
];

const parse_csv_line = (line: string): string[]=>{
    const fields: string[] = [];
    let current = '';
    let in_quotes = false;
    for (let i = 0; i < line.length; i++)
    {
        const ch = line[i];
        if (ch === '"')
        {
            if (in_quotes && line[i + 1] === '"')
            {
                current += '"';
                i++;
            }
            else
                in_quotes = !in_quotes;
        }
        else if (ch === ',' && !in_quotes)
        {
            fields.push(current.trim());
            current = '';
        }
        else
            current += ch;
    }
    fields.push(current.trim());
    return fields;
};

const handle_preview = async(api_key: string, file_path: string, print_opts: Print_opts)=>{
    if (!file_path || !fs.existsSync(file_path))
        fail(`CSV file not found: ${file_path}`);
    const content = fs.readFileSync(file_path, 'utf-8');
    const lines = content.split('\n').filter(l=>l.trim());
    if (lines.length === 0)
        fail('CSV file is empty.');
    const headers = parse_csv_line(lines[0]);
    const preview_rows = lines.slice(1, 4).map(parse_csv_line);
    if (print_opts.json || print_opts.pretty)
    {
        let custom_fields: Array<{title: string; fieldType: number}> = [];
        try {
            custom_fields = await get<typeof custom_fields>(api_key, '/v1/custom-fields/all') || [];
        } catch {}
        print({
            headers,
            sampleRows: preview_rows,
            totalRows: lines.length - 1,
            replyFields: REPLY_FIELDS,
            customFields: custom_fields,
        }, print_opts);
        return;
    }
    console.log('CSV Columns and Sample Data:');
    print_table(
        preview_rows.map(row=>{
            const obj: Record<string, string> = {};
            headers.forEach((h, i)=>obj[h] = row[i] || '');
            return obj;
        }),
        headers,
    );
    console.log(`\nTotal rows: ${lines.length - 1}`);
    console.log('\n--- Available Reply.io Fields ---');
    console.log('Standard: ' + REPLY_FIELDS.join(', '));
    try {
        const custom_fields = await get<Array<{title: string; fieldType: number}>>(
            api_key, '/v1/custom-fields/all');
        if (custom_fields?.length)
        {
            console.log('Custom fields: ' + custom_fields.map(
                f=>`${f.title} (${f.fieldType === 0 ? 'text' : 'number'})`
            ).join(', '));
        }
    } catch {}
    console.log('\n--- CSV_HEADERS_JSON ---');
    console.log(JSON.stringify(headers));
    console.log('--- END ---');
};

const handle_upload = async(
    api_key: string, file_path: string,
    mapping_json: string, list_id?: string, overwrite?: boolean,
)=>{
    if (!file_path || !fs.existsSync(file_path))
        fail(`CSV file not found: ${file_path}`);
    const mapping = JSON.parse(mapping_json);
    const options: Record<string, unknown> = {
        overwriteExisting: overwrite || false,
        mapping: {prospect: mapping},
    };
    if (list_id)
        options.listId = parseInt(list_id);
    info(`Uploading ${file_path}...`);
    const file_blob = new Blob([fs.readFileSync(file_path)], {type: 'text/csv'});
    const form_data = new FormData();
    const file_name = file_path.split('/').pop() || 'contacts.csv';
    form_data.append('file', file_blob, file_name);
    form_data.append('options', JSON.stringify(options));
    const result = await post_form_data<{importSessionId?: string}>(
        api_key, '/v1/people/import/schedules-embedded', form_data);
    if (result?.importSessionId)
        success(`CSV upload started. Import session ID: ${result.importSessionId}`);
    else
    {
        success('CSV upload completed.');
        console.log(JSON.stringify(result, null, 2));
    }
};

const import_command = new Command('import')
    .description('Import contacts from CSV files');

import_command
    .command('preview')
    .description('Preview CSV headers, sample data, and available Reply.io fields')
    .requiredOption('--file <path>', 'Path to CSV file')
    .addHelpText('after', '\nShows CSV columns, sample rows, and available Reply.io fields for mapping.\n\nExamples:\n  reply import preview --file contacts.csv')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_preview(key, opts.file, {json: opts.json, pretty: opts.pretty});
    });

import_command
    .command('upload')
    .description('Upload a CSV file with column-to-field mapping')
    .requiredOption('--file <path>', 'Path to CSV file')
    .requiredOption('--mapping <json>', 'JSON mapping of Reply fields to CSV column names')
    .option('--list-id <id>', 'Assign contacts to a list')
    .option('--overwrite', 'Overwrite existing contacts')
    .addHelpText('after', '\nUploads CSV with a mapping from Reply.io fields to CSV column headers.\n\nExamples:\n  reply import upload --file contacts.csv --mapping \'{"email":"Email Address","firstName":"First Name"}\'\n  reply import upload --file contacts.csv --mapping \'{"email":"Email"}\' --overwrite --list-id 42')
    .action(async function(this: Command) {
        const opts = this.optsWithGlobals();
        const key = resolve_api_key(opts.apiKey);
        await handle_upload(key, opts.file, opts.mapping, opts.listId, opts.overwrite);
    });

export {import_command, handle_preview, handle_upload};
