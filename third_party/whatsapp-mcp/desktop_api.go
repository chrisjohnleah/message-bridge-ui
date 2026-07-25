package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// DesktopChat is the deliberately small view of a chat needed by native
// companion applications. The existing MCP surface remains unchanged.
type DesktopChat struct {
	JID             string    `json:"jid"`
	Name            string    `json:"name"`
	LastMessageTime time.Time `json:"last_message_time"`
	LastMessage     string    `json:"last_message"`
	LastIsFromMe    bool      `json:"last_is_from_me"`
}

// DesktopMessage preserves stable identifiers so a desktop client can update
// its timeline without relying on message content or timestamps as keys.
type DesktopMessage struct {
	ID              string     `json:"id"`
	ChatJID         string     `json:"chat_jid"`
	Sender          string     `json:"sender"`
	Content         string     `json:"content"`
	Timestamp       time.Time  `json:"timestamp"`
	IsFromMe        bool       `json:"is_from_me"`
	MediaType       string     `json:"media_type"`
	Filename        string     `json:"filename"`
	QuotedMessageID string     `json:"quoted_message_id,omitempty"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
}

func boundedLimit(raw string, fallback, maximum int) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	if value > maximum {
		return maximum
	}
	return value
}

func (store *MessageStore) ListDesktopChats(limit int) ([]DesktopChat, error) {
	rows, err := store.db.Query(`
		SELECT
			c.jid,
			COALESCE(NULLIF(TRIM(c.name), ''), substr(c.jid, 1, instr(c.jid, '@') - 1)),
			c.last_message_time,
			COALESCE((
				SELECT m.content FROM messages m
				WHERE m.chat_jid = c.jid
				ORDER BY m.timestamp DESC LIMIT 1
			), ''),
			COALESCE((
				SELECT m.is_from_me FROM messages m
				WHERE m.chat_jid = c.jid
				ORDER BY m.timestamp DESC LIMIT 1
			), 0)
		FROM chats c
		WHERE c.last_message_time IS NOT NULL
		ORDER BY c.last_message_time DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	chats := make([]DesktopChat, 0)
	for rows.Next() {
		var chat DesktopChat
		var timestamp sql.NullTime
		if err := rows.Scan(
			&chat.JID,
			&chat.Name,
			&timestamp,
			&chat.LastMessage,
			&chat.LastIsFromMe,
		); err != nil {
			return nil, err
		}
		if timestamp.Valid {
			chat.LastMessageTime = timestamp.Time
		}
		chats = append(chats, chat)
	}
	return chats, rows.Err()
}

func (store *MessageStore) ListDesktopMessages(chatJID string, limit int) ([]DesktopMessage, error) {
	rows, err := store.db.Query(`
		SELECT
			id, chat_jid, sender, content, timestamp, is_from_me,
			COALESCE(media_type, ''), COALESCE(filename, ''),
			COALESCE(quoted_message_id, ''), deleted_at
		FROM messages
		WHERE chat_jid = ?
		ORDER BY timestamp DESC
		LIMIT ?`, chatJID, limit)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	messages := make([]DesktopMessage, 0)
	for rows.Next() {
		var message DesktopMessage
		var deletedAt sql.NullTime
		if err := rows.Scan(
			&message.ID,
			&message.ChatJID,
			&message.Sender,
			&message.Content,
			&message.Timestamp,
			&message.IsFromMe,
			&message.MediaType,
			&message.Filename,
			&message.QuotedMessageID,
			&deletedAt,
		); err != nil {
			return nil, err
		}
		if deletedAt.Valid {
			value := deletedAt.Time
			message.DeletedAt = &value
		}
		messages = append(messages, message)
	}
	for left, right := 0, len(messages)-1; left < right; left, right = left+1, right-1 {
		messages[left], messages[right] = messages[right], messages[left]
	}
	return messages, rows.Err()
}

func registerDesktopHandlers(
	mux *http.ServeMux,
	auth func(http.HandlerFunc) http.HandlerFunc,
	store *MessageStore,
) {
	mux.HandleFunc("/api/chats", auth(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		chats, err := store.ListDesktopChats(boundedLimit(r.URL.Query().Get("limit"), 100, 200))
		if err != nil {
			http.Error(w, "Failed to list chats", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"chats": chats})
	}))

	mux.HandleFunc("/api/messages", auth(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		chatJID := strings.TrimSpace(r.URL.Query().Get("chat_jid"))
		if chatJID == "" {
			http.Error(w, "chat_jid is required", http.StatusBadRequest)
			return
		}
		messages, err := store.ListDesktopMessages(
			chatJID,
			boundedLimit(r.URL.Query().Get("limit"), 100, 500),
		)
		if err != nil {
			http.Error(w, "Failed to list messages", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"messages": messages})
	}))
}
