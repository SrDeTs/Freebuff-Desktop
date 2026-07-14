# Freebuff Desktop

**Cursor-style desktop shell for the real [Freebuff](https://freebuff.com) CLI.**

No fake Automations. No fake Pro wall. No pretend agent backend.

Every session spawns the Freebuff binary (`~/.config/manicode/freebuff`). History is read from Freebuff’s own chat store. Models and ads sync to Freebuff settings.

![Freebuff Desktop](https://freebuff.com)

## Requirements

- Node 18+
- Freebuff CLI: `npm install -g freebuff` then `freebuff login`

## Run the app

```bash
npm install
npm run dev
```

## What’s real

| UI | Backend |
|----|---------|
| New Agent | `freebuff --cwd <project>` via node-pty |
| Continue / follow-up | `freebuff --continue <id>` |
| Sidebar history | `~/.config/manicode/projects/*/chats` |
| Transcript tools/agents | `chat-messages.json` blocks |
| Model picker | writes `freebuffModel` in manicode settings |
| Sign in | `freebuff login` |
| Ads banner | Freebuff free-tier model + live CLI ad parse |
| Notifications | Electron Notification on session exit |

## Freebuff slash commands (inside live agent)

`/help` `/new` `/history` `/bash` `/init` `/feedback` `/theme:toggle` `/logout` `/exit`

## Website

Static landing page in [`website/`](./website) — deploy with Vercel:

```bash
cd website && vercel --prod
```

## License

MIT. Freebuff Desktop is independent and not affiliated with Codebuff/Freebuff Inc.
