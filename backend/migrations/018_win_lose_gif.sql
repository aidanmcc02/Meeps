-- Win and Lose GIF URLs for League of Legends Diana match embeds.
-- When a match result is posted, use win_gif_url for wins and lose_gif_url for losses/remakes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS win_gif_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lose_gif_url TEXT;
