-- League of Legends in-game username for matching Diana match embeds to user banners
ALTER TABLE users ADD COLUMN IF NOT EXISTS league_username TEXT DEFAULT '';
