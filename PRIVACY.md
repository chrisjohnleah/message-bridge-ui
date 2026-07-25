# Privacy

Message Bridge has no project-operated account service, analytics, telemetry,
advertising, or subscription system.

## Stored locally

The application stores linked-session credentials, its message archive,
business configuration, and assistant memory in Electron's application data
directory. Linked accounts use separate local data directories. API keys are
encrypted with Electron `safeStorage` only when a secure operating-system
backend is available.

## Data that can leave your computer

- Linking and messaging necessarily communicate with the relevant messaging
  service.
- When you request an AI draft, selected messages, saved context, and business
  instructions are sent to the provider you configured, under that provider's
  terms and privacy policy.
- An MCP client can read only accounts you enable. It can send messages only
  where you separately enable send access. That client may transmit retrieved
  data to its own provider.
- Opening links to GitHub or other external sites uses your default browser.

## Controls

You can export or erase assistant memory in **Open source & privacy**. Erasing
assistant memory does not erase the bridge's message archive or remote messages.
To remove all local application data, quit the app and remove its application
data directory using your operating system's normal controls.

This document describes the project code as published. Third-party builds may
be modified; inspect their source and provenance before use.
