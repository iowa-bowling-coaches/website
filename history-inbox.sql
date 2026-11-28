CREATE TABLE IF NOT EXISTS history_submissions (
  id INTEGER PRIMARY KEY,
  received_at INTEGER NOT NULL DEFAULT (unixepoch()),
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  link TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS history_submissions_received_at ON history_submissions (received_at);
