# Message Bridge visual contract

Message Bridge should feel calm, legible, and inspectable: a useful desktop
tool rather than a social-network clone.

## Identity

- Name: **Message Bridge**
- Mark: two cobalt endpoints joined by a simple horizontal bridge
- No provider logos, WhatsApp green, speech-bubble marks, or commercial brand
  remnants
- Voice: direct, candid, and specific about data movement and risk

## System

- Canvas: warm ivory `#F5F2EA`
- Paper: `#FFFDF8`
- Ink: `#171A1F`
- Primary: cobalt `#3659D9`
- Attention: amber `#E8A52B`
- Lines: stone `#D0C9BA`
- Geometry: 10–12px corners, flat panels, restrained shadows
- Navigation: compact icon rail with text labels and visible focus states

## Image-first references

The implementation was designed against four standalone references generated
for this repository:

- `docs/design/setup-reference.png`
- `docs/design/inbox-reference.png`
- `docs/design/connections-reference.png`
- `docs/design/open-source-reference.png`

They define composition and hierarchy, not pixel-perfect screenshots. Native
HTML text, Lucide icons, CSS geometry, and the code-native bridge mark are used
in the app so controls stay accessible and crisp.

## Safety UI requirements

- Never describe local transport as meaning data cannot leave the computer.
- AI setup must be skippable.
- MCP access must begin disabled.
- MCP read and send grants must be visually distinct.
- The Open source & privacy page must keep the unofficial-use warning visible.
