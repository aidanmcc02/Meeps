-- Messages table for real-time chat history

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

