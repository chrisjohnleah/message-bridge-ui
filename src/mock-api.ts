import type {
  Chat,
  ChatMessage,
  MemorySnapshot,
  MessageBridgeApi,
  PublicConfig,
  WhatsAppAccount
} from "./types";

export function createMockApi(): MessageBridgeApi {
  const now = Date.now();
  let accounts: WhatsAppAccount[] = [
    {
      id: "primary",
      name: "Valley Upholstery",
      createdAt: new Date(now - 30 * 86_400_000).toISOString(),
      isPrimary: true,
      mcpEnabled: false,
      mcpSendEnabled: false,
      status: { phase: "connected" as const, connected: true }
    },
    {
      id: "workshop",
      name: "Workshop enquiries",
      createdAt: new Date(now - 7 * 86_400_000).toISOString(),
      isPrimary: false,
      mcpEnabled: false,
      mcpSendEnabled: false,
      status: { phase: "connected" as const, connected: true }
    }
  ];
  const chats: Chat[] = [
    {
      jid: "14155550187@s.whatsapp.net",
      name: "Maya Thompson",
      last_message_time: new Date(now - 5 * 60_000).toISOString(),
      last_message: "Thanks! Could you confirm the fabric colour again?",
      last_is_from_me: false,
      accountId: "primary",
      accountName: "Valley Upholstery"
    },
    {
      jid: "447700900123@s.whatsapp.net",
      name: "Tom Patel",
      last_message_time: new Date(now - 42 * 60_000).toISOString(),
      last_message: "Do you offer a repair service for dining chairs?",
      last_is_from_me: false,
      accountId: "workshop",
      accountName: "Workshop enquiries"
    }
  ];
  const messages: ChatMessage[] = [
    {
      id: "1",
      chat_jid: chats[0].jid,
      sender: "14155550187",
      content: "Can you confirm the natural linen colour? We’re leaning toward oat.",
      timestamp: new Date(now - 23 * 60_000).toISOString(),
      is_from_me: false,
      media_type: "",
      filename: ""
    },
    {
      id: "2",
      chat_jid: chats[0].jid,
      sender: "me",
      content: "Yes, the natural linen in oat is available.",
      timestamp: new Date(now - 18 * 60_000).toISOString(),
      is_from_me: true,
      media_type: "",
      filename: ""
    }
  ];

  let config: PublicConfig = {
    setupComplete: new URLSearchParams(location.search).get("screen") !== "onboarding",
    business: {
      name: "Willow & Stitch",
      description: "Bespoke upholstery and made-to-measure soft furnishings.",
      tone: "Friendly, concise and reassuring",
      hours: "Monday–Friday, 9am–5pm"
    },
    provider: { id: "openai", model: "gpt-4.1-mini", hasApiKey: true }
  };
  let memory: MemorySnapshot = {
    facts: [
      { id: "b1", category: "business", content: "Opening hours are Monday–Friday, 9am–5pm.", createdAt: new Date().toISOString() },
      { id: "p1", category: "products", content: "Natural linen is stocked in oat, flax and chalk.", createdAt: new Date().toISOString() },
      { id: "v1", category: "voice", content: "Friendly and concise; never promise an unavailable date.", createdAt: new Date().toISOString() }
    ],
    customers: {
      [`${chats[0].accountId}:${chats[0].jid}`]: {
        jid: chats[0].jid,
        accountId: chats[0].accountId,
        accountName: chats[0].accountName,
        name: chats[0].name,
        summary: "Maya is planning a June wedding.",
        facts: ["Wedding seat pads • 18 units", "Prefers natural linen", "Colour: oat"],
        nextStep: "Send fabric photo and confirm Friday’s quote.",
        updatedAt: new Date().toISOString()
      }
    },
    suggestions: [],
    controls: {
      learnFromApprovedReplies: true,
      suggestFactsForReview: true,
      includeCustomerHistory: true
    }
  };

  return {
    config: {
      get: async () => config,
      saveBusiness: async (business) => (config = { ...config, business }),
      saveProvider: async (provider) => (config = {
        ...config,
        provider: { ...provider, hasApiKey: Boolean(provider.apiKey) || config.provider.hasApiKey }
      }),
      complete: async () => (config = { ...config, setupComplete: true })
    },
    bridge: {
      start: async () => ({ phase: "waiting_for_scan", connected: false, qrCode: "message-bridge-demo-pairing-code" }),
      restart: async () => ({ phase: "connected", connected: true }),
      status: async () => ({
        phase: config.setupComplete ? "connected" : "waiting_for_scan",
        connected: config.setupComplete,
        qrCode: config.setupComplete ? undefined : "message-bridge-demo-pairing-code"
      }),
      chats: async () => chats,
      messages: async (_accountId, jid) => jid === chats[0].jid ? messages : [],
      send: async () => undefined
    },
    accounts: {
      list: async () => accounts,
      add: async (name) => {
        const account = {
          id: crypto.randomUUID(),
          name: name.trim(),
          createdAt: new Date().toISOString(),
          isPrimary: false,
          mcpEnabled: false,
          mcpSendEnabled: false,
          status: {
            phase: "waiting_for_scan" as const,
            connected: false,
            qrCode: "message-bridge-demo-second-account"
          }
        };
        accounts = [...accounts, account];
        return account;
      },
      rename: async (accountId, name) => {
        accounts = accounts.map((account) => account.id === accountId ? { ...account, name } : account);
        return accounts;
      },
      setMcpEnabled: async (accountId, enabled) => {
        accounts = accounts.map((account) =>
          account.id === accountId
            ? { ...account, mcpEnabled: enabled, mcpSendEnabled: enabled ? account.mcpSendEnabled : false }
            : account
        );
        return accounts;
      },
      setMcpSendEnabled: async (accountId, enabled) => {
        accounts = accounts.map((account) =>
          account.id === accountId && account.mcpEnabled
            ? { ...account, mcpSendEnabled: enabled }
            : account
        );
        return accounts;
      }
    },
    mcp: {
      setup: async () => ({
        command: "/Applications/Message Bridge.app/Contents/MacOS/Message Bridge",
        args: ["/Applications/Message Bridge.app/Contents/Resources/app.asar/dist-electron/mcp-server.js"],
        env: {
          ELECTRON_RUN_AS_NODE: "1",
          MESSAGE_BRIDGE_USER_DATA: "/Users/you/Library/Application Support/Message Bridge"
        },
        claudeConfig: JSON.stringify({
          mcpServers: {
            "message-bridge": {
              command: "/Applications/Message Bridge.app/Contents/MacOS/Message Bridge",
              args: ["/Applications/Message Bridge.app/Contents/Resources/app.asar/dist-electron/mcp-server.js"],
              env: {
                ELECTRON_RUN_AS_NODE: "1",
                MESSAGE_BRIDGE_USER_DATA: "/Users/you/Library/Application Support/Message Bridge"
              }
            }
          }
        }, null, 2),
        codexConfig: `[mcp_servers.message_bridge]\ncommand = "/Applications/Message Bridge.app/Contents/MacOS/Message Bridge"\nargs = ["/Applications/Message Bridge.app/Contents/Resources/app.asar/dist-electron/mcp-server.js"]`,
        otherConfig: JSON.stringify({
          "message-bridge": {
            command: "/Applications/Message Bridge.app/Contents/MacOS/Message Bridge",
            args: ["/Applications/Message Bridge.app/Contents/Resources/app.asar/dist-electron/mcp-server.js"]
          }
        }, null, 2),
        userDataPath: "/Users/you/Library/Application Support/Message Bridge"
      }),
      copy: async () => true
    },
    assistant: {
      test: async (provider) => {
        config = {
          ...config,
          provider: { ...provider, hasApiKey: Boolean(provider.apiKey) || config.provider.hasApiKey }
        };
        return config;
      },
      draft: async () => "Absolutely — I’ll confirm the oat linen and send the updated quote today."
    },
    memory: {
      get: async () => memory,
      addFact: async (category, content) => (memory = {
        ...memory,
        facts: [...memory.facts, { id: crypto.randomUUID(), category, content, createdAt: new Date().toISOString() }]
      }),
      updateControls: async (controls) => (memory = { ...memory, controls }),
      reviewSuggestion: async (id, keep) => {
        const suggestion = memory.suggestions.find((item) => item.id === id);
        memory = {
          ...memory,
          facts: keep && suggestion
            ? [...memory.facts, { id: crypto.randomUUID(), category: "business", content: suggestion.content, createdAt: new Date().toISOString() }]
            : memory.facts,
          suggestions: memory.suggestions.filter((item) => item.id !== id)
        };
        return memory;
      },
      saveCustomer: async (customer) => (memory = {
        ...memory,
        customers: {
          ...memory.customers,
          [customer.accountId ? `${customer.accountId}:${customer.jid}` : customer.jid]: customer
        }
      }),
      export: async () => true,
      erase: async () => (memory = {
        facts: [],
        customers: {},
        suggestions: [],
        controls: {
          learnFromApprovedReplies: true,
          suggestFactsForReview: true,
          includeCustomerHistory: true
        }
      })
    }
  };
}
