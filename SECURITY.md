# Security

AppShelf is a local desktop app that can execute commands from project manifests. Only scan folders and run apps you trust.

## Reporting Security Issues

This project is currently pre-release. If the repository is shared privately, report security concerns directly to the repository owner. After public release, this section should be updated with a private disclosure contact.

## Security Boundaries

- `.localapp.json` commands are executable instructions.
- AppShelf should not auto-run newly discovered commands.
- AppShelf should not upload logs or project metadata automatically.
- AppShelf should not store tokens, API keys, passwords, or private credentials in `.localapp.json`.
- Logs and screenshots may contain local paths or app output; remove sensitive content before sharing.

## Safety Notes

AppShelf is provided as a personal/open-source tool without warranty. Review commands before running them, and do not add projects you do not trust.
