package main

import (
	"testing"
	"time"
)

func TestBoundedLimit(t *testing.T) {
	tests := []struct {
		raw      string
		expected int
	}{
		{"", 50},
		{"nope", 50},
		{"0", 50},
		{"20", 20},
		{"999", 100},
	}
	for _, test := range tests {
		if actual := boundedLimit(test.raw, 50, 100); actual != test.expected {
			t.Fatalf("boundedLimit(%q) = %d, want %d", test.raw, actual, test.expected)
		}
	}
}

func TestListDesktopChatsAndMessages(t *testing.T) {
	store := newTestMessageStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	if err := store.StoreChat("12025550123@s.whatsapp.net", "Maya", now); err != nil {
		t.Fatal(err)
	}
	if err := store.StoreMessage(
		"msg-1",
		"12025550123@s.whatsapp.net",
		"12025550123",
		"Hello there",
		now,
		false,
		"",
		"",
		"",
		nil,
		nil,
		nil,
		0,
		"",
	); err != nil {
		t.Fatal(err)
	}

	chats, err := store.ListDesktopChats(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(chats) != 1 || chats[0].Name != "Maya" || chats[0].LastMessage != "Hello there" {
		t.Fatalf("unexpected chats: %#v", chats)
	}

	messages, err := store.ListDesktopMessages("12025550123@s.whatsapp.net", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 1 || messages[0].ID != "msg-1" || messages[0].Content != "Hello there" {
		t.Fatalf("unexpected messages: %#v", messages)
	}
}
