<h1 align="center">Reply.io CLI</h1>

<p align="center">
  Manage sequences, contacts, email accounts, and schedules — directly from your terminal.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/reply-cli"><img src="https://img.shields.io/npm/v/reply-cli?color=black&label=npm" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-black" alt="node requirement" />
  <img src="https://img.shields.io/badge/license-MIT-black" alt="license" />
</p>

---

## Overview

`reply-cli` is the command-line interface for [Reply.io](https://reply.io). It installs the `reply` command for managing your outreach from the terminal:

| Command | What it does |
|---|---|
| `reply sequences` | List, create, clone, start, pause, and archive outreach sequences |
| `reply sequences stats` | View per-step performance, top performers, and aggregate summary |
| `reply sequence-contacts` | Add and remove contacts from sequences |
| `reply contacts` | Create, update, delete, and search contacts with lifecycle actions |
| `reply accounts` | List connected email accounts |
| `reply schedules` | Manage sending schedules |
| `reply import` | Import contacts from CSV with column mapping |

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Commands](#commands)
  - [sequences](#sequences)
  - [sequences stats](#sequences-stats)
  - [sequence-contacts](#sequence-contacts)
  - [contacts](#contacts)
  - [import](#import)
  - [accounts](#accounts)
  - [schedules](#schedules)
- [Output Modes](#output-modes)
- [Pipe-Friendly Usage](#pipe-friendly-usage)
- [Troubleshooting](#troubleshooting)

---

## Installation

> **Requires [Node.js](https://nodejs.org/) >= 20**

```bash
npm install -g reply-cli
```

Or run without installing:

```bash
npx reply-cli sequences list
```

---

## Quick Start

```bash
# 1. Set your API key
export REPLY_API_KEY=your-api-key

# 2. List your sequences
reply sequences list

# 3. Create a contact
reply contacts create --email john@example.com --first-name John --company Acme

# 4. Add the contact to a sequence
reply sequence-contacts add --contact john@example.com --sequence 12345

# 5. Check sequence performance
reply sequences stats 12345

# 6. View aggregate stats
reply sequences stats --summary
```

---

## Authentication

Get your API key from [Reply.io Settings > API](https://run.reply.io/Dashboard/Material#/settings/api).

```bash
# Environment variable
export REPLY_API_KEY=your-api-key

# Or pass directly to any command
reply sequences list --api-key your-api-key

# Or put it in a .env file in your project directory
echo "REPLY_API_KEY=your-api-key" >> .env
```

**Resolution order** (highest priority first):

```
--api-key flag  →  REPLY_API_KEY env var  →  .env file (walks up directories)
```

---

## Commands

### `sequences`

Manage outreach sequences (campaigns).

```bash
reply sequences list                          # List all sequences with stats
reply sequences get <id>                      # Get details and email steps
reply sequences create                        # Create from stdin JSON
reply sequences update <id>                   # Update settings from stdin JSON
reply sequences clone <id> --name "New Name"  # Clone with all steps
reply sequences start <id>                    # Start sending emails
reply sequences pause <id>                    # Pause sending
reply sequences archive <id>                  # Archive sequence
```

**Examples**

```bash
# List all sequences
reply sequences list

# Get sequence details as JSON
reply sequences get 12345 --json

# Create a sequence from a config file
cat config.json | reply sequences create

# Clone a sequence
reply sequences clone 12345 --name "Q2 Outreach"

# Start a paused sequence
reply sequences start 12345
```

**Create sequence JSON format:**

```json
{
  "name": "My Sequence",
  "emailAccounts": ["sender@company.com"],
  "settings": {
    "emailsCountPerDay": 50,
    "daysToFinishProspect": 7,
    "EmailSendingDelaySeconds": 55
  },
  "steps": [
    {
      "number": "1",
      "InMinutesCount": "0",
      "templates": [{ "subject": "Quick question", "body": "Hi {{FirstName}}!" }]
    },
    {
      "number": "2",
      "InMinutesCount": "1440",
      "templates": [{ "subject": "Following up", "body": "Hi {{FirstName}}, just checking in." }]
    }
  ]
}
```

---

### `sequences stats`

View sequence performance statistics.

```bash
reply sequences stats <id>       # Detailed per-step stats for a sequence
reply sequences stats --top      # Top 3 sequences by reply rate
reply sequences stats --summary  # Aggregate performance across all sequences
```

**Examples**

```bash
# Per-step breakdown: sent, opens, replies, bounces, clicks
reply sequences stats 12345

# Top performers
reply sequences stats --top

# Account-wide summary as JSON
reply sequences stats --summary --json
```

---

### `sequence-contacts`

Add or remove contacts from sequences.

```bash
reply sequence-contacts add --contact <email> --sequence <id> [--force]
reply sequence-contacts add-new --contact <email> --first-name <name> --sequence <id>
reply sequence-contacts add-bulk --contacts <ids> --sequence <id> [--overwrite]
reply sequence-contacts remove --contact <email> --sequence <id>
reply sequence-contacts remove-all --contact <email>
```

| Subcommand | What it does |
|---|---|
| `add` | Enroll an existing contact in a sequence. `--force` moves from another active sequence |
| `add-new` | Create a contact and enroll in one step |
| `add-bulk` | Enroll multiple contacts by ID (comma-separated) |
| `remove` | Remove from a specific sequence |
| `remove-all` | Remove from all sequences |

**Examples**

```bash
# Add existing contact to sequence
reply sequence-contacts add --contact john@co.com --sequence 12345

# Create + enroll in one step
reply sequence-contacts add-new --contact jane@co.com --first-name Jane --sequence 12345

# Bulk enroll by contact IDs
reply sequence-contacts add-bulk --contacts 111,222,333 --sequence 12345

# Remove from all sequences
reply sequence-contacts remove-all --contact john@co.com
```

---

### `contacts`

Manage contacts (prospects).

```bash
reply contacts list [--page N --limit N]       # Paginated contact list
reply contacts get <id|email>                  # Contact details
reply contacts create --email <email> --first-name <name> [options]
reply contacts update --email <email> [options]
reply contacts delete <id|email>               # Delete a contact
reply contacts search --email <email>          # Search by email
reply contacts search --linkedin <url>         # Lookup by LinkedIn URL
reply contacts mark-replied <email>            # Mark as replied in all sequences
reply contacts mark-finished <email>           # Mark as finished in all sequences
reply contacts opt-out <email>                 # Remove from all sequences
reply contacts stats <email>                   # Campaign history and email activity
```

| Flag | Description |
|---|---|
| `--email <email>` | Email address (required for create/update) |
| `--first-name <name>` | First name (required for create) |
| `--last-name <name>` | Last name |
| `--company <company>` | Company name |
| `--title <title>` | Job title |
| `--phone <phone>` | Phone number |
| `--linkedin <url>` | LinkedIn profile URL |
| `--city`, `--state`, `--country` | Location fields |
| `--custom <fields>` | Custom fields: `Key1=Val1,Key2=Val2` |

**Examples**

```bash
# Create a contact
reply contacts create --email john@co.com --first-name John --company Acme --title CEO

# Update company
reply contacts update --email john@co.com --company "New Corp"

# View contact performance
reply contacts stats john@co.com

# Mark as finished
reply contacts mark-finished john@co.com
```

---

### `import`

Import contacts from CSV files.

```bash
reply import preview --file <path>                         # Preview CSV and available fields
reply import upload --file <path> --mapping <json> [opts]  # Upload with column mapping
```

| Flag | Description |
|---|---|
| `--file <path>` | Path to CSV file |
| `--mapping <json>` | JSON mapping Reply fields to CSV column names |
| `--list-id <id>` | Assign contacts to a list |
| `--overwrite` | Overwrite existing contacts |

**Examples**

```bash
# Preview CSV structure and available Reply.io fields
reply import preview --file contacts.csv

# Upload with mapping
reply import upload \
  --file contacts.csv \
  --mapping '{"email":"Email Address","firstName":"First Name","company":"Company"}' \
  --overwrite
```

---

### `accounts`

Manage connected email accounts.

```bash
reply accounts list    # List all connected email accounts
reply accounts check   # Machine-readable check (ACCOUNTS_FOUND:<n> or NO_ACCOUNTS)
```

---

### `schedules`

Manage sending schedules.

```bash
reply schedules list               # List all schedules
reply schedules get <id>           # Schedule details
reply schedules create             # Create from stdin JSON
reply schedules delete <id>        # Delete a schedule
reply schedules set-default <id>   # Set as the default schedule
```

**Examples**

```bash
# List schedules
reply schedules list

# Create a schedule
echo '{
  "name": "Business Hours",
  "timezoneId": "Eastern Standard Time",
  "mainTimings": [
    {"weekDay":"Monday","isActive":true,"timeRanges":[{"fromTime":{"hour":9,"minute":0},"toTime":{"hour":17,"minute":0}}]},
    {"weekDay":"Tuesday","isActive":true,"timeRanges":[{"fromTime":{"hour":9,"minute":0},"toTime":{"hour":17,"minute":0}}]}
  ]
}' | reply schedules create

# Set as default
reply schedules set-default 12345
```

---

## Output Modes

Every command supports:

| Mode | Flag | Behavior |
|---|---|---|
| Human-readable | *(default)* | Formatted table with colors |
| JSON | `--json` | Compact JSON to stdout |
| Pretty JSON | `--pretty` | Indented JSON to stdout |

```bash
# Table output (default)
reply sequences list

# Compact JSON
reply sequences list --json

# Pretty JSON
reply sequences list --pretty
```

---

## Pipe-Friendly Usage

When stdout is not a TTY, colors are automatically disabled. Errors go to `stderr`, data to `stdout`.

```bash
# Get all sequence IDs
reply sequences list --json | jq '.[].id'

# Export contacts as JSON
reply contacts list --limit 100 --json > contacts.json

# Check if accounts exist in a script
if reply accounts check 2>/dev/null; then
  echo "Accounts connected"
fi
```

---

## Troubleshooting

**`REPLY_API_KEY not found`**

```bash
export REPLY_API_KEY=your-api-key
# or
echo "REPLY_API_KEY=your-api-key" >> .env
```

**`Invalid API key`**

Check your key at [Reply.io Settings > API](https://run.reply.io/Dashboard/Material#/settings/api).

**`Rate limit exceeded`**

Reply.io allows 15,000 API calls/month. Some endpoints (campaign list, stats) have a 10-second throttle between requests.

**`Access denied`**

You may need the owner/master API key for this operation.

---

## Links

- [Reply.io](https://reply.io)
- [Reply.io API Documentation](https://apidocs.reply.io)
- [API Key Settings](https://run.reply.io/Dashboard/Material#/settings/api)
- [Report an Issue](https://github.com/replyio/reply-cli/issues)

---

<p align="center">
  <sub>MIT License</sub>
</p>
