import {
  Archive,
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Code2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Inbox as InboxIcon,
  Info,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageCircleMore,
  MonitorCog,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  TriangleAlert,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { api } from "./api";
import type {
  BridgeStatus,
  BusinessProfile,
  Chat,
  ChatMessage,
  CustomerMemory,
  MemoryFact,
  MemorySnapshot,
  McpSetup,
  ProviderId,
  ProviderInput,
  PublicConfig,
  WhatsAppAccount
} from "./types";

type View = "inbox" | "customers" | "memory" | "connections" | "settings" | "about";

const providerDefaults: Record<ProviderId, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-4-5-20250929",
  gemini: "gemini-2.5-flash",
  "openai-compatible": ""
};

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

function friendlyError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function customerMemoryKey(chat: Pick<Chat, "accountId" | "jid">): string {
  return `${chat.accountId}:${chat.jid}`;
}

function formatConversationTime(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { weekday: "short" });
}

function Progress({ step }: { step: number }) {
  const steps = ["Business", "Link account", "AI assistant"];
  return (
    <ol className="progress" aria-label={`Setup step ${step} of 3`}>
      {steps.map((label, index) => {
        const number = index + 1;
        return (
          <li key={label} className={number === step ? "active" : number < step ? "done" : ""}>
            <span>{number < step ? <Check size={16} /> : number}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function BusinessStep({
  initial,
  onContinue
}: {
  initial: BusinessProfile;
  onContinue(value: BusinessProfile): Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (field: keyof BusinessProfile, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.description.trim()) {
      setError("Tell Message Bridge your business name and what you do.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onContinue(form);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="business-step setup-form" onSubmit={submit}>
      <div className="setup-copy">
        <p className="eyebrow">A little context first</p>
        <h1>Tell us about your business</h1>
        <p>Message Bridge can use this context when you ask it to draft a reply.</p>
      </div>
      <div className="form-grid">
        <label>
          Business name
          <input
            autoFocus
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Willow & Stitch"
          />
        </label>
        <label>
          What do you do?
          <textarea
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Bespoke upholstery and made-to-measure soft furnishings."
          />
        </label>
        <label>
          How should replies sound?
          <input value={form.tone} onChange={(event) => update("tone", event.target.value)} />
        </label>
        <label>
          Opening hours <span className="optional">Optional</span>
          <input
            value={form.hours}
            onChange={(event) => update("hours", event.target.value)}
            placeholder="Monday–Friday, 9am–5pm"
          />
        </label>
      </div>
      {error && <p className="form-error" role="alert"><CircleAlert size={17} />{error}</p>}
      <div className="setup-actions">
        <span />
        <button className="primary" disabled={busy} type="submit">
          {busy ? <LoaderCircle className="spin" size={18} /> : null}
          Continue
        </button>
      </div>
    </form>
  );
}

function WhatsAppStep({
  onBack,
  onContinue
}: {
  onBack(): void;
  onContinue(): void;
}) {
  const [status, setStatus] = useState<BridgeStatus>({ phase: "starting", connected: false });
  const [qrImage, setQrImage] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const next = await api.bridge.status();
      setStatus(next);
      if (next.qrCode) {
        setQrImage(await QRCode.toDataURL(next.qrCode, {
          width: 420,
          margin: 2,
          color: { dark: "#17201C", light: "#FFFEFA" }
        }));
      }
    } catch (reason) {
      setError(friendlyError(reason));
    }
  };

  useEffect(() => {
    void api.bridge.start().then(setStatus).catch((reason) => setError(friendlyError(reason)));
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="pairing-step">
      <div className="pairing-copy">
        <p className="eyebrow">Your existing account</p>
        <h1>Connect WhatsApp</h1>
        <p>On your phone, open WhatsApp → Settings → Linked Devices.</p>
        <p>Scan the code to connect this computer.</p>
        <div className="local-note"><ShieldCheck size={22} />Your chats stay on this computer.</div>
      </div>
      <div className="pairing-visual">
        <div className="qr-surface" aria-label="WhatsApp pairing QR code">
          {qrImage ? (
            <img src={qrImage} alt="QR code to pair this computer with WhatsApp" />
          ) : (
            <div className="qr-loading">
              <LoaderCircle className="spin" size={28} />
              <span>Preparing secure code…</span>
            </div>
          )}
        </div>
        <p className={`connection-line ${status.connected ? "connected" : ""}`}>
          <span />
          {status.connected ? "Connected" : status.phase === "expired" ? "Code expired" : "Waiting for scan"}
        </p>
        {!status.connected && (
          <button className="secondary wide" onClick={() => void refresh()}>
            <RefreshCw size={18} /> I’ve scanned it
          </button>
        )}
        {error && <p className="form-error" role="alert"><CircleAlert size={17} />{error}</p>}
      </div>
      <div className="setup-actions pairing-actions">
        <button className="quiet" onClick={onBack}><ArrowLeft size={18} />Back</button>
        <button className="primary" disabled={!status.connected} onClick={onContinue}>Continue</button>
      </div>
    </section>
  );
}

function ProviderStep({
  initial,
  onBack,
  onFinish
}: {
  initial: PublicConfig["provider"];
  onBack(): void;
  onFinish(value?: ProviderInput): Promise<void>;
}) {
  const [provider, setProvider] = useState<ProviderId>(initial.id);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? "");
  const [showKey, setShowKey] = useState(false);
  const [tested, setTested] = useState(false);
  const [busy, setBusy] = useState<"test" | "finish" | "">("");
  const [error, setError] = useState("");
  const canUseStoredKey = initial.hasApiKey && provider === initial.id;

  const choose = (id: ProviderId) => {
    setProvider(id);
    setModel(id === initial.id ? initial.model : providerDefaults[id]);
    setBaseUrl(id === initial.id ? initial.baseUrl ?? "" : "");
    setTested(false);
    setError("");
  };
  const value = (): ProviderInput => ({ id: provider, model, baseUrl, apiKey: apiKey || undefined });

  const test = async () => {
    setBusy("test");
    setError("");
    try {
      await api.assistant.test(value());
      setTested(true);
      setApiKey("");
    } catch (reason) {
      setTested(false);
      setError(friendlyError(reason));
    } finally {
      setBusy("");
    }
  };

  const finish = async () => {
    if (!tested && !canUseStoredKey) {
      setError("Test the connection before finishing setup.");
      return;
    }
    setBusy("finish");
    setError("");
    try {
      await onFinish(value());
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy("");
    }
  };

  const providers: Array<{ id: ProviderId; name: string; detail: string }> = [
    { id: "openai", name: "OpenAI", detail: "Use an API key" },
    { id: "anthropic", name: "Anthropic", detail: "Use an API key" },
    { id: "gemini", name: "Google Gemini", detail: "Use an API key" },
    { id: "openai-compatible", name: "OpenAI-compatible", detail: "Use a custom base URL" }
  ];

  return (
    <section className="provider-step">
      <div className="provider-choice">
        <h1>Choose your AI assistant</h1>
        <p>Optional: connect a provider to draft replies. Selected message context is sent to that provider only when you request a draft.</p>
        <fieldset className="provider-list">
          <legend className="sr-only">AI provider</legend>
          {providers.map((item) => (
            <label key={item.id} className={provider === item.id ? "selected" : ""}>
              <input
                type="radio"
                name="provider"
                value={item.id}
                checked={provider === item.id}
                onChange={() => choose(item.id)}
              />
              <span className="radio-mark" />
              <span><strong>{item.name}</strong><small>{item.detail}</small></span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="provider-config">
        <h2>Connect {providers.find((item) => item.id === provider)?.name}</h2>
        <label>
          API key
          <span className="secret-input">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => { setApiKey(event.target.value); setTested(false); }}
              placeholder={canUseStoredKey ? "Stored securely — enter to replace" : "Paste your API key"}
              autoComplete="off"
            />
            <button type="button" aria-label={showKey ? "Hide API key" : "Show API key"} onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </span>
        </label>
        <label>
          Model
          <input value={model} onChange={(event) => { setModel(event.target.value); setTested(false); }} />
        </label>
        {provider === "openai-compatible" && (
          <label>
            Base URL
            <input
              value={baseUrl}
              onChange={(event) => { setBaseUrl(event.target.value); setTested(false); }}
              placeholder="https://provider.example.com"
            />
          </label>
        )}
        <button className="primary wide" disabled={busy === "test" || !model || (!apiKey && !canUseStoredKey)} onClick={() => void test()}>
          {busy === "test" ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
          Test connection
        </button>
        {tested && <p className="success-line"><Check size={17} />Connection works. Your key is stored securely on this computer.</p>}
        <details>
          <summary><ChevronDown size={17} />Advanced provider settings</summary>
          <p>Message Bridge uses API credentials only. It does not reuse a consumer subscription session.</p>
        </details>
        {error && <p className="form-error" role="alert"><CircleAlert size={17} />{error}</p>}
      </div>
      <div className="setup-actions provider-actions">
        <button className="quiet" onClick={onBack}><ArrowLeft size={18} />Back</button>
        <span className="provider-finish-actions">
          <button className="quiet" disabled={Boolean(busy)} onClick={() => void onFinish()}>Skip AI for now</button>
          <button className="primary" disabled={busy === "finish"} onClick={() => void finish()}>
            {busy === "finish" ? <LoaderCircle className="spin" size={18} /> : null}
            Finish setup
          </button>
        </span>
      </div>
    </section>
  );
}

function Onboarding({ config, onComplete }: { config: PublicConfig; onComplete(value: PublicConfig): void }) {
  const [step, setStep] = useState(1);
  const [current, setCurrent] = useState(config);

  const saveBusiness = async (business: BusinessProfile) => {
    const result = await api.config.saveBusiness(business);
    setCurrent(result);
    setStep(2);
  };
  const finish = async (provider?: ProviderInput) => {
    if (provider) await api.config.saveProvider(provider);
    const result = await api.config.complete();
    onComplete(result);
  };

  return (
    <main id="main-content" className="onboarding">
      <header className="onboarding-header"><span className="brand">Message Bridge</span><Progress step={step} /></header>
      {step === 1 && <BusinessStep initial={current.business} onContinue={saveBusiness} />}
      {step === 2 && <WhatsAppStep onBack={() => setStep(1)} onContinue={() => setStep(3)} />}
      {step === 3 && <ProviderStep initial={current.provider} onBack={() => setStep(2)} onFinish={finish} />}
    </main>
  );
}

function Navigation({ active, onChange }: { active: View; onChange(view: View): void }) {
  const items: Array<{ id: View; label: string; icon: typeof InboxIcon }> = [
    { id: "inbox", label: "Inbox", icon: InboxIcon },
    { id: "customers", label: "Customers", icon: UsersRound },
    { id: "memory", label: "Memory", icon: BookOpen },
    { id: "connections", label: "Connections", icon: Link2 },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    { id: "about", label: "Open source", icon: Info }
  ];
  return (
    <nav className="app-nav" aria-label="Primary">
      <div className="nav-brand" aria-label="Message Bridge">
        <span className="bridge-mark" aria-hidden="true"><i /><i /><i /></span>
        <strong>MB</strong>
      </div>
      <div className="nav-items">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => onChange(item.id)}>
              <Icon size={21} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="local-status">
        <span />Local-first
        <small>Data stored on this computer</small>
      </div>
    </nav>
  );
}

function ContextPane({
  chat,
  memory,
  onChange,
  open,
  onClose
}: {
  chat: Chat;
  memory?: CustomerMemory;
  onChange(value: MemorySnapshot): void;
  open: boolean;
  onClose(): void;
}) {
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(memory?.summary ?? "");
  const [facts, setFacts] = useState(memory?.facts.join("\n") ?? "");
  const [nextStep, setNextStep] = useState(memory?.nextStep ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEditing(false);
    setSummary(memory?.summary ?? "");
    setFacts(memory?.facts.join("\n") ?? "");
    setNextStep(memory?.nextStep ?? "");
    setError("");
  }, [chat.accountId, chat.jid, memory?.updatedAt]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.memory.saveCustomer({
        jid: chat.jid,
        accountId: chat.accountId,
        accountName: chat.accountName,
        name: chat.name,
        summary: summary.trim(),
        facts: facts.split("\n").map((fact) => fact.trim()).filter(Boolean),
        nextStep: nextStep.trim(),
        updatedAt: memory?.updatedAt ?? new Date().toISOString()
      });
      onChange(result);
      setEditing(false);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className={`context-pane ${open ? "open" : ""}`} aria-label="Customer context">
      <header>
        <h2>Customer context</h2>
        <div>
          <button className="text-button" onClick={() => setEditing((value) => !value)}>
            {editing ? "Cancel" : "Edit"}
          </button>
          <button className="icon-button context-close" aria-label="Close customer context" onClick={onClose}><X size={17} /></button>
        </div>
      </header>
      {editing ? (
        <form className="context-form" onSubmit={save}>
          <label>Summary<textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder={`Useful context about ${chat.name}`} /></label>
          <label>What matters<textarea value={facts} onChange={(event) => setFacts(event.target.value)} placeholder={"One detail per line"} /></label>
          <label>Next step<input value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="What should happen next?" /></label>
          <button className="primary compact" disabled={busy} type="submit">
            {busy ? <LoaderCircle className="spin" size={16} /> : null}Save context
          </button>
          {error && <p className="form-error" role="alert"><CircleAlert size={16} />{error}</p>}
        </form>
      ) : (
        <>
          <section>
            <h3>Summary</h3>
            <p>{memory?.summary || `No summary saved for ${chat.name} yet.`}</p>
          </section>
          <section>
            <h3>What matters</h3>
            {memory?.facts.length ? <ul>{memory.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : <p>Customer details you save will appear here.</p>}
          </section>
          <section>
            <h3>Next step</h3>
            <p>{memory?.nextStep || "No next step saved."}</p>
          </section>
          <p className="context-updated">{memory ? `Updated ${formatConversationTime(memory.updatedAt)}` : "Local customer memory"}</p>
        </>
      )}
    </aside>
  );
}

function InboxView({
  memory,
  onMemoryChange,
  onOpenConnections
}: {
  memory: MemorySnapshot;
  onMemoryChange(value: MemorySnapshot): void;
  onOpenConnections(): void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selected, setSelected] = useState<Chat>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "needs" | "waiting">("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [composer, setComposer] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"draft" | "send" | "">("");
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [contextOpen, setContextOpen] = useState(false);

  const loadChats = async () => {
    try {
      const [values, accountValues] = await Promise.all([api.bridge.chats(), api.accounts.list()]);
      setChats(values);
      setAccounts(accountValues);
      setSelected((current) => {
        if (!current) return values[0];
        return values.find((chat) =>
          chat.accountId === current.accountId && chat.jid === current.jid
        ) ?? values[0];
      });
      setConnectionError("");
    } catch {
      setConnectionError("No WhatsApp account is connected. Open Connections to scan a code.");
    }
  };

  useEffect(() => {
    void loadChats();
    const timer = window.setInterval(() => void loadChats(), 8000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const loadMessages = async () => {
      try {
        setMessages(await api.bridge.messages(selected.accountId, selected.jid));
        setConnectionError("");
      } catch {
        setConnectionError("This WhatsApp account needs attention. Open Connections to reconnect it.");
      }
    };
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 5_000);
    return () => window.clearInterval(timer);
  }, [selected?.accountId, selected?.jid]);

  const filtered = useMemo(() => chats.filter((chat) => {
    const matchesSearch = `${chat.name} ${chat.last_message}`.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (accountFilter !== "all" && chat.accountId !== accountFilter) return false;
    if (filter === "waiting") return chat.last_is_from_me;
    if (filter === "needs") return !chat.last_is_from_me;
    return true;
  }), [accountFilter, chats, filter, search]);

  const generate = async () => {
    if (!selected) return;
    setBusy("draft");
    setError("");
    try {
      setDraft(await api.assistant.draft({ chat: selected, messages }));
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy("");
    }
  };

  const send = async () => {
    if (!selected || !composer.trim()) return;
    setBusy("send");
    setError("");
    try {
      await api.bridge.send(selected.accountId, selected.jid, composer);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        chat_jid: selected.jid,
        sender: "me",
        content: composer.trim(),
        timestamp: new Date().toISOString(),
        is_from_me: true,
        media_type: "",
        filename: ""
      }]);
      setComposer("");
      setDraft("");
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="inbox-view">
      <section className="conversation-list" aria-label="Conversations">
        <h1>Inbox</h1>
        <label className="account-filter">
          <UsersRound size={17} />
          <span className="sr-only">Filter by WhatsApp account</span>
          <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
            <option value="all">All accounts · {accounts.filter((account) => account.status.connected).length}</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="search-box"><Search size={19} /><span className="sr-only">Search conversations</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" /></label>
        <div className="filters" aria-label="Conversation filters">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
          <button className={filter === "needs" ? "active" : ""} onClick={() => setFilter("needs")}>Needs reply</button>
          <button className={filter === "waiting" ? "active" : ""} onClick={() => setFilter("waiting")}>Waiting</button>
        </div>
        <div className="chat-list">
          {filtered.map((chat) => (
            <button
              key={`${chat.accountId}:${chat.jid}`}
              className={selected?.accountId === chat.accountId && selected?.jid === chat.jid ? "selected" : ""}
              onClick={() => setSelected(chat)}
            >
              <span className="avatar">{initials(chat.name)}</span>
              <span className="chat-copy">
                <strong>{chat.name}</strong>
                <small>{chat.last_message || "Attachment"}</small>
                <em>{chat.accountName}</em>
              </span>
              <time>{formatConversationTime(chat.last_message_time)}</time>
              {!chat.last_is_from_me && <span className="unread-dot" aria-label="Needs reply" />}
            </button>
          ))}
        </div>
      </section>
      {selected ? (
        <>
          <main id="main-content" className="thread">
            <header className="thread-header">
              <span className="avatar">{initials(selected.name)}</span>
              <span>
                <h2>{selected.name}</h2>
                <small>{selected.jid.split("@")[0]}</small>
              </span>
              <span className="account-route"><Smartphone size={14} />via {selected.accountName}</span>
              <button aria-label="Customer context" aria-expanded={contextOpen} onClick={() => setContextOpen((value) => !value)}><UserRound size={20} /></button>
            </header>
            <div className="message-scroll">
              <div className="date-divider"><span>Today</span></div>
              {messages.map((message) => (
                <article key={message.id} className={`message ${message.is_from_me ? "outgoing" : "incoming"}`}>
                  <p>{message.deleted_at ? "This message was deleted." : message.content || `[${message.media_type || "Attachment"}]`}</p>
                  <time>{new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                </article>
              ))}
            </div>
            <div className="composer-area">
              {draft ? (
                <section className="draft-panel" aria-label="Suggested reply">
                  <div className="draft-heading"><Sparkles size={18} /><strong>Suggested reply</strong></div>
                  <p>{draft}</p>
                  <div>
                    <button className="primary compact" onClick={() => { setComposer(draft); setDraft(""); }}>Use draft</button>
                    <button className="secondary compact" disabled={busy === "draft"} onClick={() => void generate()}>Try again</button>
                    <button className="icon-button" aria-label="Dismiss draft" onClick={() => setDraft("")}><X size={18} /></button>
                  </div>
                </section>
              ) : (
                <button className="suggest-button" disabled={busy === "draft"} onClick={() => void generate()}>
                  {busy === "draft" ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                  Suggest a reply
                </button>
              )}
              <div className="composer">
                <textarea value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="Write a reply…" />
                <span className="composer-route"><Smartphone size={14} />via {selected.accountName}</span>
                <button className="primary send-button" disabled={!composer.trim() || busy === "send"} onClick={() => void send()}>
                  {busy === "send" ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
                  Send
                </button>
              </div>
              {(error || connectionError) && <p className="form-error composer-error" role="alert"><CircleAlert size={16} />{error || connectionError}</p>}
            </div>
          </main>
          <ContextPane
            chat={selected}
            memory={memory.customers[customerMemoryKey(selected)] ?? memory.customers[selected.jid]}
            onChange={onMemoryChange}
            open={contextOpen}
            onClose={() => setContextOpen(false)}
          />
        </>
      ) : (
        <main id="main-content" className="empty-thread">
          {connectionError ? <CircleAlert size={38} /> : <MessageCircleMore size={38} />}
          <h2>{connectionError ? "WhatsApp needs attention" : "Your conversations will appear here"}</h2>
          <p>{connectionError || "Keep Message Bridge open while the first history sync finishes."}</p>
          {connectionError && <button className="primary" onClick={onOpenConnections}>Open Connections</button>}
        </main>
      )}
    </div>
  );
}

function CustomersView({ memory }: { memory: MemorySnapshot }) {
  const customers = Object.values(memory.customers);
  return (
    <main id="main-content" className="page customers-page">
      <header className="page-header"><div><h1>Customers</h1><p>Context Message Bridge can use when helping you reply.</p></div></header>
      <div className="customer-table">
        <div className="table-head"><span>Customer</span><span>What matters</span><span>Next step</span></div>
        {customers.map((customer) => (
          <article key={customer.jid}>
            <span className="avatar">{initials(customer.name || customer.jid.split("@")[0])}</span>
            <span><strong>{customer.name || customer.jid.split("@")[0]}</strong><small>{customer.jid.split("@")[0]}</small></span>
            <p>{customer.facts.join(" • ")}</p>
            <p>{customer.nextStep}</p>
          </article>
        ))}
        {!customers.length && <div className="empty-list"><UsersRound size={30} /><p>Customer context will appear as you add it from conversations.</p></div>}
      </div>
    </main>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean;
  onChange(value: boolean): void;
  label: string;
  description: string;
}) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle" aria-hidden="true" />
    </label>
  );
}

function MemoryView({ value, onChange }: { value: MemorySnapshot; onChange(value: MemorySnapshot): void }) {
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<MemoryFact["category"]>("business");
  const [content, setContent] = useState("");
  const groups: Array<{ id: MemoryFact["category"]; title: string; detail: string }> = [
    { id: "business", title: "Business basics", detail: "Opening hours, service area, lead times" },
    { id: "products", title: "Products & pricing", detail: "Products, options, quote rules" },
    { id: "voice", title: "How you communicate", detail: "Tone, boundaries and promises" }
  ];

  const setControl = async (key: keyof MemorySnapshot["controls"], next: boolean) => {
    onChange(await api.memory.updateControls({ ...value.controls, [key]: next }));
  };
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    onChange(await api.memory.addFact(category, content));
    setContent("");
    setAdding(false);
  };

  return (
    <main id="main-content" className="page memory-page">
      <header className="page-header">
        <div><h1>Business memory</h1><p>Teach your assistant how your business works. You review every change.</p></div>
        <button className="secondary" onClick={() => setAdding(!adding)}><Plus size={18} />Add knowledge</button>
      </header>
      {adding && (
        <form className="add-knowledge" onSubmit={add}>
          <label>Category<select value={category} onChange={(event) => setCategory(event.target.value as MemoryFact["category"])}><option value="business">Business basics</option><option value="products">Products & pricing</option><option value="voice">How you communicate</option></select></label>
          <label>What should Message Bridge know?<input autoFocus value={content} onChange={(event) => setContent(event.target.value)} placeholder="e.g. Quotes are valid for 30 days" /></label>
          <button className="primary" type="submit">Save fact</button>
        </form>
      )}
      <div className="memory-layout">
        <div>
          <section className="knowledge-section">
            <h2>What your assistant knows</h2>
            {groups.map((group) => {
              const facts = value.facts.filter((fact) => fact.category === group.id);
              return (
                <article key={group.id} className="knowledge-row">
                  <span className="knowledge-icon">{group.id === "products" ? <Archive size={20} /> : group.id === "voice" ? <MessageCircleMore size={20} /> : <BookOpen size={20} />}</span>
                  <span><h3>{group.title}</h3><p>{group.detail}</p></span>
                  <span className="fact-count">{facts.length} {facts.length === 1 ? "fact" : "facts"}</span>
                  <button className="text-button" onClick={() => { setCategory(group.id); setAdding(true); }}>Add</button>
                </article>
              );
            })}
          </section>
          <section className="learning-section">
            <h2>Recent learning</h2>
            {value.suggestions.map((suggestion) => (
              <article key={suggestion.id}>
                <span className="timeline-dot" />
                <span className="suggestion-source"><small>{formatConversationTime(suggestion.createdAt)}</small><small>{suggestion.source}</small></span>
                <p>{suggestion.content}</p>
                <div><button className="secondary compact" onClick={() => void api.memory.reviewSuggestion(suggestion.id, true).then(onChange)}>Keep</button><button className="quiet compact" onClick={() => void api.memory.reviewSuggestion(suggestion.id, false).then(onChange)}>Dismiss</button></div>
              </article>
            ))}
            {!value.suggestions.length && <p className="muted">No suggestions waiting for review.</p>}
          </section>
        </div>
        <aside className="memory-controls">
          <h2>Memory controls</h2>
          <Toggle checked={value.controls.learnFromApprovedReplies} onChange={(next) => void setControl("learnFromApprovedReplies", next)} label="Learn from approved replies" description="Your approved replies help the assistant understand your business." />
          <Toggle checked={value.controls.suggestFactsForReview} onChange={(next) => void setControl("suggestFactsForReview", next)} label="Suggest new facts for review" description="Nothing becomes business knowledge until you keep it." />
          <Toggle checked={value.controls.includeCustomerHistory} onChange={(next) => void setControl("includeCustomerHistory", next)} label="Include customer history in drafts" description="Relevant recent messages help draft a better reply." />
          <p className="privacy-note"><LockKeyhole size={19} />Memory is stored locally and only shared with your chosen AI provider when needed for a draft.</p>
          <details className="memory-data-actions">
            <summary>Export or erase memory</summary>
            <div>
              <button className="secondary compact" onClick={() => void api.memory.export()}>Export JSON</button>
              <button className="quiet compact danger" onClick={() => void api.memory.erase().then(onChange)}>Erase memory</button>
            </div>
          </details>
        </aside>
      </div>
    </main>
  );
}

type McpClient = "claude" | "codex" | "other";

function ConnectionsView({ onOpenInbox }: { onOpenInbox(): void }) {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [linking, setLinking] = useState<WhatsAppAccount>();
  const [linkMode, setLinkMode] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [setup, setSetup] = useState<McpSetup>();
  const [client, setClient] = useState<McpClient>("claude");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const values = await api.accounts.list();
      setAccounts(values);
      setLinking((current) => current
        ? values.find((account) => account.id === current.id)
        : undefined);
      setError("");
    } catch (reason) {
      setError(friendlyError(reason));
    }
  };

  useEffect(() => {
    void refresh();
    void api.mcp.setup().then(setSetup).catch((reason) => setError(friendlyError(reason)));
    const timer = window.setInterval(() => void refresh(), 1_500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!linking?.status.qrCode) {
      setQrImage("");
      return;
    }
    void QRCode.toDataURL(linking.status.qrCode, {
      width: 430,
      margin: 2,
      color: { dark: "#17201C", light: "#FFFEFA" }
    }).then(setQrImage).catch((reason) => setError(friendlyError(reason)));
  }, [linking?.status.qrCode]);

  const createAccount = async () => {
    setBusy("add");
    setError("");
    try {
      const account = await api.accounts.add(accountName);
      setAccounts((current) => [...current, account]);
      setLinking(account);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy("");
    }
  };

  const restart = async (account: WhatsAppAccount) => {
    setBusy(account.id);
    setError("");
    try {
      const status = await api.bridge.restart(account.id);
      const next = { ...account, status };
      setAccounts((current) => current.map((item) => item.id === account.id ? next : item));
      setLinking(next);
      setLinkMode(true);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy("");
    }
  };

  const setMcpEnabled = async (account: WhatsAppAccount, enabled: boolean) => {
    try {
      setAccounts(await api.accounts.setMcpEnabled(account.id, enabled));
    } catch (reason) {
      setError(friendlyError(reason));
    }
  };

  const setMcpSendEnabled = async (account: WhatsAppAccount, enabled: boolean) => {
    try {
      setAccounts(await api.accounts.setMcpSendEnabled(account.id, enabled));
    } catch (reason) {
      setError(friendlyError(reason));
    }
  };

  const config = setup
    ? client === "claude"
      ? setup.claudeConfig
      : client === "codex"
        ? setup.codexConfig
        : setup.otherConfig
    : "";

  const copyConfig = async () => {
    if (!config) return;
    await api.mcp.copy(config);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };

  if (linkMode) {
    return (
      <main id="main-content" className="page connections-page link-page">
        <header className="page-header">
          <div>
            <h1>Link a WhatsApp account</h1>
            <p>Give this connection a name, then scan once with your phone.</p>
          </div>
        </header>
        <div className="link-layout">
          <section className="link-instructions">
            <label>
              Account name
              <input
                autoFocus={!linking}
                disabled={Boolean(linking)}
                value={linking?.name ?? accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Showroom phone"
              />
            </label>
            <ol>
              <li><span>1</span><strong>Open WhatsApp on this phone</strong></li>
              <li><span>2</span><strong>Go to Settings → Linked Devices</strong></li>
              <li><span>3</span><strong>Tap Link a Device and scan</strong></li>
            </ol>
          </section>
          <section className="link-qr">
            <div className="connection-qr">
              {qrImage ? (
                <img src={qrImage} alt={`QR code to link ${linking?.name ?? "this WhatsApp account"}`} />
              ) : linking?.status.connected ? (
                <div className="qr-success"><Check size={38} /><strong>Account connected</strong></div>
              ) : (
                <div className="qr-loading">
                  {busy === "add" ? <LoaderCircle className="spin" size={30} /> : <Smartphone size={38} />}
                  <span>Create the connection to show its secure code.</span>
                </div>
              )}
            </div>
            {linking ? (
              <>
                <p className={`link-status ${linking.status.connected ? "connected" : ""}`}>
                  <span />
                  {linking.status.connected ? "Connected" : linking.status.phase === "expired" ? "Code expired" : "Waiting for scan"}
                </p>
                <small>{linking.status.connected ? "This account is ready." : "This code refreshes when you request a new one."}</small>
                {!linking.status.connected && (
                  <button className="text-button refresh-link" disabled={busy === linking.id} onClick={() => void restart(linking)}>
                    <RefreshCw size={16} />Get a new code
                  </button>
                )}
              </>
            ) : (
              <button className="primary create-connection" disabled={busy === "add" || accountName.trim().length < 2} onClick={() => void createAccount()}>
                {busy === "add" ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}
                Create secure connection
              </button>
            )}
          </section>
        </div>
        {error && <p className="form-error connections-error" role="alert"><CircleAlert size={17} />{error}</p>}
        <footer className="link-footer">
          <p><ShieldCheck size={21} />This account gets its own private session on this computer.</p>
          <div>
            <button className="secondary" onClick={() => { setLinkMode(false); setLinking(undefined); setAccountName(""); }}>Back</button>
            <button className="primary" disabled={!linking?.status.connected} onClick={() => { setLinkMode(false); setLinking(undefined); }}>Finish linking</button>
          </div>
        </footer>
      </main>
    );
  }

  return (
    <main id="main-content" className="page connections-page">
      <header className="page-header">
        <div><h1>Messaging accounts</h1><p>Each linked account stays separate on this computer.</p></div>
        <button className="primary" onClick={() => { setLinkMode(true); setLinking(undefined); setAccountName(""); }}>
          <Plus size={18} />Link another account
        </button>
      </header>

      <section className="account-list" aria-label="Messaging accounts">
        {accounts.map((account) => (
          <article key={account.id} className="account-row">
            <span className={`account-device ${account.status.connected ? "online" : ""}`}><Smartphone size={23} /></span>
            <span className="account-copy">
              <strong>{account.name}</strong>
              <small className={account.status.connected ? "connected" : ""}>
                <span />{account.status.connected ? "Connected" : account.status.phase === "waiting_for_scan" ? "Needs scan" : "Needs attention"}
              </small>
            </span>
            <span className="account-sync"><small>Session</small><strong>{account.isPrimary ? "Original account" : "Separate local profile"}</strong></span>
            <button
              className={account.status.connected ? "secondary" : "primary"}
              onClick={() => {
                if (account.status.connected) onOpenInbox();
                else {
                  setLinking(account);
                  setLinkMode(true);
                }
              }}
            >
              {account.status.connected ? "Open inbox" : "Continue linking"}
            </button>
            {!account.status.connected && (
              <button className="icon-button" aria-label={`Restart ${account.name}`} disabled={busy === account.id} onClick={() => void restart(account)}>
                <RefreshCw className={busy === account.id ? "spin" : ""} size={18} />
              </button>
            )}
          </article>
        ))}
      </section>
      <p className="accounts-privacy"><ShieldCheck size={21} /><span><strong>Sessions and the local message archive stay on this computer.</strong><small>AI providers receive selected context only when you request a draft.</small></span></p>

      <section className="mcp-section">
        <header>
          <div>
            <p className="eyebrow">Local MCP access</p>
            <h2>Use Message Bridge with an MCP client</h2>
            <p>Access is off by default for every linked account. Sending requires a second permission.</p>
          </div>
          <span className="mcp-ready"><span />Local MCP ready</span>
        </header>
        <div className="mcp-tabs" role="tablist" aria-label="MCP client">
          <button role="tab" aria-selected={client === "claude"} className={client === "claude" ? "active" : ""} onClick={() => setClient("claude")}><MonitorCog size={18} />Claude Desktop</button>
          <button role="tab" aria-selected={client === "codex"} className={client === "codex" ? "active" : ""} onClick={() => setClient("codex")}><Sparkles size={18} />Codex</button>
          <button role="tab" aria-selected={client === "other"} className={client === "other" ? "active" : ""} onClick={() => setClient("other")}><Terminal size={18} />Other apps</button>
        </div>
        <div className="mcp-layout">
          <section>
            <h3>Copy this configuration into {client === "claude" ? "Claude Desktop" : client === "codex" ? "Codex" : "your MCP client"}</h3>
            <pre><code>{config || "Preparing your local configuration…"}</code></pre>
            <button className="primary" disabled={!config} onClick={() => void copyConfig()}>
              {copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "Copied" : "Copy configuration"}
            </button>
          </section>
          <aside>
            <h3>Accounts available to this connection</h3>
            {accounts.map((account) => (
              <div key={account.id} className="mcp-account-permissions">
                <div className="mcp-account-name">
                  <span className={`account-device small ${account.status.connected ? "online" : ""}`}><Smartphone size={18} /></span>
                  <span><strong>{account.name}</strong><small>{account.status.connected ? "Ready" : "Finish linking first"}</small></span>
                </div>
                <label className="mcp-permission-row">
                  <span><strong>Read access</strong><small>Search chats and read messages</small></span>
                  <input type="checkbox" checked={account.mcpEnabled} disabled={!account.status.connected}
                    onChange={(event) => void setMcpEnabled(account, event.target.checked)} />
                  <span className="toggle" aria-hidden="true" />
                </label>
                <label className="mcp-permission-row">
                  <span><strong>Send access</strong><small>Allow the MCP client to send messages</small></span>
                  <input type="checkbox" checked={account.mcpSendEnabled} disabled={!account.status.connected || !account.mcpEnabled}
                    onChange={(event) => void setMcpSendEnabled(account, event.target.checked)} />
                  <span className="toggle" aria-hidden="true" />
                </label>
              </div>
            ))}
          </aside>
        </div>
        <p className="mcp-note"><ShieldCheck size={19} />Message Bridge must be open. The MCP transport is local, but your MCP client may send retrieved data to its own provider.</p>
      </section>
      {error && <p className="form-error connections-error" role="alert"><CircleAlert size={17} />{error}</p>}
    </main>
  );
}

function SettingsView({ config, onConfig }: { config: PublicConfig; onConfig(value: PublicConfig): void }) {
  const [provider, setProvider] = useState<ProviderId>(config.provider.id);
  const [model, setModel] = useState(config.provider.model);
  const [baseUrl, setBaseUrl] = useState(config.provider.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [providerBusy, setProviderBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const test = async () => {
    setProviderBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api.assistant.test({ id: provider, model, baseUrl, apiKey: apiKey || undefined });
      onConfig(result);
      setApiKey("");
      setMessage("Connection works. Settings saved securely.");
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setProviderBusy(false);
    }
  };

  return (
    <main id="main-content" className="page settings-page">
      <header className="page-header"><div><h1>Settings</h1><p>Your AI provider and sending safeguards.</p></div></header>
      <section className="settings-section">
        <div><h2>AI assistant</h2><p>API keys are encrypted using this computer’s secure credential store.</p></div>
        <div className="settings-form">
          <label>Provider<select value={provider} onChange={(event) => { const id = event.target.value as ProviderId; setProvider(id); setModel(providerDefaults[id]); setApiKey(""); setMessage(""); setError(""); }}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Google Gemini</option><option value="openai-compatible">OpenAI-compatible</option></select></label>
          <label>Model<input value={model} onChange={(event) => setModel(event.target.value)} /></label>
          {provider === "openai-compatible" && <label>Base URL<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>}
          <label>Replace API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider === config.provider.id && config.provider.hasApiKey ? "Stored securely" : "Paste API key"} /></label>
          <button className="primary" disabled={providerBusy || !model.trim() || (provider !== config.provider.id && !apiKey.trim())} onClick={() => void test()}>{providerBusy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}Test and save</button>
          {message && <p className="success-line"><Check size={17} />{message}</p>}
          {error && <p className="form-error" role="alert"><CircleAlert size={17} />{error}</p>}
        </div>
      </section>
      <section className="settings-section">
        <div><h2>App updates</h2><p>Releases and source code are published openly on GitHub.</p></div>
        <div className="update-card">
          <div className="update-heading">
            <span className="status-dot online" />
            <div>
              <strong>Message Bridge releases</strong>
              <small>Review release notes and checksums before installing.</small>
            </div>
          </div>
          <div className="update-actions">
            <a className="secondary button-link" href="https://github.com/chrisjohnleah/message-bridge-ui/releases" target="_blank" rel="noreferrer">
              <ExternalLink size={17} />View releases
            </a>
          </div>
        </div>
      </section>
      <section className="settings-section">
        <div><h2>Sending safety</h2><p>Inbox sends require a click. MCP sending is separately disabled for each account by default.</p></div>
        <div className="safety-statement"><ShieldCheck size={22} /><strong>Least privilege by default</strong><small>Review Connections before granting any external client access.</small></div>
      </section>
    </main>
  );
}

function AboutView() {
  const [notice, setNotice] = useState("");
  const runMemoryAction = async (action: "export" | "erase") => {
    if (action === "export") {
      const saved = await api.memory.export();
      if (saved) setNotice("Assistant memory exported.");
      return;
    }
    await api.memory.erase();
    setNotice("Assistant memory erased from this computer.");
  };

  return (
    <main id="main-content" className="page about-page">
      <header className="page-header about-header">
        <div><p className="eyebrow">Message Bridge</p><h1>Open source &amp; privacy</h1><p>A local desktop interface for an unofficial messaging bridge—free to inspect, change and share under its licence.</p></div>
        <a className="primary button-link" href="https://github.com/chrisjohnleah/message-bridge-ui" target="_blank" rel="noreferrer"><Code2 size={18} />View source</a>
      </header>
      <section className="about-warning">
        <TriangleAlert size={24} />
        <div><strong>Unofficial compatibility software</strong><p>This project is not affiliated with, endorsed by or sponsored by WhatsApp LLC or Meta Platforms, Inc. Automated or unsupported use may breach provider terms and could lead to account restrictions. You use it at your own risk.</p></div>
      </section>
      <div className="about-grid">
        <section><p className="eyebrow">Your data</p><h2>Local by default, explicit when it leaves</h2><ul><li>Linked sessions and the message archive are stored on this computer.</li><li>AI is optional. When you request a draft, selected context goes to your configured provider.</li><li>MCP access starts off. Read and send permissions are granted separately per account.</li></ul></section>
        <section><p className="eyebrow">Licence</p><h2>GPL-3.0-only distribution</h2><p>The app includes and builds on separately licensed open-source components. Their original notices and licence texts are preserved in the repository and distributions.</p><a href="https://github.com/chrisjohnleah/message-bridge-ui/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">Third-party notices <ExternalLink size={15} /></a></section>
        <section><p className="eyebrow">Upstream</p><h2>Credit where it belongs</h2><p>The bridge started from the MIT-licensed whatsapp-mcp project by Luke Harries, with later work by Very Good Plugins. Message Bridge is an independent downstream interface.</p><a href="https://github.com/verygoodplugins/whatsapp-mcp" target="_blank" rel="noreferrer">Visit upstream <ExternalLink size={15} /></a></section>
        <section><p className="eyebrow">Controls</p><h2>Manage assistant memory</h2><p>Export or erase saved business facts and customer context. This does not erase the bridge message archive.</p><div className="about-actions"><button className="secondary" onClick={() => void runMemoryAction("export")}>Export memory</button><button className="danger-button" onClick={() => void runMemoryAction("erase")}>Erase memory</button></div>{notice && <p className="success-line"><Check size={17} />{notice}</p>}</section>
      </div>
    </main>
  );
}

function Workspace({ initialConfig }: { initialConfig: PublicConfig }) {
  const screen = new URLSearchParams(location.search).get("screen");
  const [view, setView] = useState<View>(
    screen === "memory" || screen === "settings" || screen === "customers" || screen === "connections" || screen === "about"
      ? screen
      : "inbox"
  );
  const [config, setConfig] = useState(initialConfig);
  const [memory, setMemory] = useState<MemorySnapshot>({
    facts: [],
    customers: {},
    suggestions: [],
    controls: {
      learnFromApprovedReplies: true,
      suggestFactsForReview: true,
      includeCustomerHistory: true
    }
  });

  useEffect(() => {
    void api.memory.get().then(setMemory);
  }, []);

  return (
    <div className="workspace">
      <Navigation active={view} onChange={setView} />
      <div className="workspace-content">
        {view === "inbox" && <InboxView memory={memory} onMemoryChange={setMemory} onOpenConnections={() => setView("connections")} />}
        {view === "customers" && <CustomersView memory={memory} />}
        {view === "memory" && <MemoryView value={memory} onChange={setMemory} />}
        {view === "connections" && <ConnectionsView onOpenInbox={() => setView("inbox")} />}
        {view === "settings" && <SettingsView config={config} onConfig={setConfig} />}
        {view === "about" && <AboutView />}
      </div>
    </div>
  );
}

export function App() {
  const [config, setConfig] = useState<PublicConfig>();
  const [error, setError] = useState("");

  useEffect(() => {
    void api.config.get()
      .then(setConfig)
      .catch((reason) => setError(friendlyError(reason)));
  }, []);

  if (error) {
    return <main className="fatal-error"><CircleAlert size={34} /><h1>Message Bridge couldn’t open</h1><p>{error}</p><button className="primary" onClick={() => location.reload()}>Try again</button></main>;
  }
  if (!config) return <main className="app-loading"><LoaderCircle className="spin" size={30} /><span>Opening Message Bridge…</span></main>;
  return config.setupComplete
    ? <Workspace initialConfig={config} />
    : <Onboarding config={config} onComplete={setConfig} />;
}
