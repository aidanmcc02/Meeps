-- Link board issues to GitHub Projects V2 (optional). When set, we sync create/update to GitHub and pull new items on sync.
ALTER TABLE board_issues
  ADD COLUMN IF NOT EXISTS github_project_item_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_board_issues_github_project_item_id
  ON board_issues (github_project_item_id)
  WHERE github_project_item_id IS NOT NULL;
