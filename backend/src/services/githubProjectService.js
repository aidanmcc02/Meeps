/**
 * GitHub Projects V2 (GraphQL) integration: create draft issues, list items, update status.
 * Config: GITHUB_TOKEN (required) and either:
 *   - GITHUB_PROJECT_ID (node ID, e.g. PVT_...), or
 *   - GITHUB_PROJECT_OWNER + GITHUB_PROJECT_NUMBER from the project URL.
 *     URL like https://github.com/users/OWNER/projects/NUMBER or .../orgs/OWNER/projects/NUMBER
 *     → OWNER = GITHUB_PROJECT_OWNER, NUMBER = GITHUB_PROJECT_NUMBER.
 *   - Optional GITHUB_PROJECT_OWNER_TYPE=user or org (default: user).
 */

const axios = require("axios");

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

/** Normalize status label for mapping (e.g. "In Progress" -> "in_progress"). */
const STATUS_TO_APP = {
  todo: "todo",
  "to do": "todo",
  "in progress": "in_progress",
  "in_progress": "in_progress",
  done: "done",
};

const APP_TO_GITHUB_LABEL = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

/** In-memory cache: resolved project node ID when using owner+number (avoids repeated GraphQL). */
let resolvedProjectIdCache = null;

function getConfig() {
  const token = process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim();
  if (!token) return null;
  const projectId = process.env.GITHUB_PROJECT_ID && process.env.GITHUB_PROJECT_ID.trim();
  if (projectId) return { token, projectId };
  const owner = process.env.GITHUB_PROJECT_OWNER && process.env.GITHUB_PROJECT_OWNER.trim();
  const numberRaw = process.env.GITHUB_PROJECT_NUMBER && process.env.GITHUB_PROJECT_NUMBER.trim();
  const number = numberRaw ? parseInt(numberRaw, 10) : NaN;
  if (!owner || !Number.isInteger(number) || number < 1) return null;
  const ownerType = (process.env.GITHUB_PROJECT_OWNER_TYPE || "user").toLowerCase();
  return { token, owner, number, ownerType: ownerType === "org" ? "org" : "user" };
}

/**
 * Resolve project node ID. If config has projectId (PVT_...), return it.
 * If config has owner+number, query GitHub GraphQL and return the project id (cached).
 */
async function getProjectId(config) {
  if (!config) return null;
  if (config.projectId) return config.projectId;
  if (config.owner && config.number != null) {
    if (resolvedProjectIdCache) return resolvedProjectIdCache;
    const { token, owner, number, ownerType } = config;
    const query =
      ownerType === "org"
        ? `query($owner: String!, $number: Int!) { organization(login: $owner) { projectV2(number: $number) { id } } }`
        : `query($owner: String!, $number: Int!) { user(login: $owner) { projectV2(number: $number) { id } } }`;
    const { data } = await axios.post(
      GITHUB_GRAPHQL,
      { query, variables: { owner, number } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
        validateStatus: (s) => s === 200,
      }
    );
    if (data.errors && data.errors.length) {
      const msg = data.errors.map((e) => e.message).join("; ");
      throw new Error(`GitHub project lookup failed: ${msg}`);
    }
    const node = data.data?.organization?.projectV2 || data.data?.user?.projectV2;
    if (!node || !node.id) throw new Error("GitHub project not found. Check GITHUB_PROJECT_OWNER and GITHUB_PROJECT_NUMBER.");
    resolvedProjectIdCache = node.id;
    return node.id;
  }
  return null;
}

async function graphql(query, variables = {}) {
  const config = getConfig();
  if (!config) throw new Error("GitHub project not configured (GITHUB_TOKEN, GITHUB_PROJECT_ID)");
  const { data } = await axios.post(
    GITHUB_GRAPHQL,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
      validateStatus: (s) => s === 200,
    }
  );
  if (data.errors && data.errors.length) {
    const msg = data.errors.map((e) => e.message).join("; ");
    throw new Error(msg);
  }
  return data.data;
}

/**
 * Fetch project fields and return Status field id and option id by name (for single-select).
 * @returns {{ statusFieldId: string, optionsByName: Record<string, string> } | null}
 */
async function getProjectStatusField(projectId) {
  const data = await graphql(
    `query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }`,
    { projectId }
  );
  const fields = data?.node?.fields?.nodes ?? [];
  const statusField = fields.find((f) => f && f.name && f.name.toLowerCase() === "status");
  if (!statusField || !statusField.options?.length) return null;
  const optionsByName = {};
  for (const opt of statusField.options) {
    if (opt.name) optionsByName[opt.name.toLowerCase().trim()] = opt.id;
  }
  return { statusFieldId: statusField.id, optionsByName };
}

/**
 * Create a draft issue on the project. Returns project item node ID.
 * @returns {Promise<string>} projectItemId
 */
async function createDraftIssue(projectId, title, body = "") {
  const data = await graphql(
    `mutation($projectId: ID!, $title: String!, $body: String!) {
      addProjectV2DraftIssue(input: { projectId: $projectId, title: $title, body: $body }) {
        projectItem {
          id
        }
      }
    }`,
    { projectId, title: String(title).trim(), body: body ? String(body).trim() : "" }
  );
  const id = data?.addProjectV2DraftIssue?.projectItem?.id;
  if (!id) throw new Error("GitHub did not return project item id");
  return id;
}

/**
 * Update a project item's Status field. statusApp is our value: "todo" | "in_progress" | "done".
 */
async function updateItemStatus(projectId, itemId, statusApp) {
  const statusMeta = await getProjectStatusField(projectId);
  if (!statusMeta) return;
  const label = APP_TO_GITHUB_LABEL[statusApp] || "Todo";
  const optionId = statusMeta.optionsByName[label.toLowerCase()];
  if (!optionId) return;
  await graphql(
    `mutation($input: UpdateProjectV2ItemFieldValueInput!) {
      updateProjectV2ItemFieldValue(input: $input) {
        projectV2Item { id }
      }
    }`,
    {
      input: {
        projectId,
        itemId,
        fieldId: statusMeta.statusFieldId,
        value: { singleSelectOptionId: optionId },
      },
    }
  );
}

/**
 * List project items (draft issues and issues). Returns array of { id, title, description, statusName }.
 * statusName is the raw Status field value (e.g. "Todo", "In Progress", "Done").
 */
async function listProjectItems(projectId, maxItems = 100) {
  const out = [];
  let cursor = null;
  const pageSize = 50;
  while (out.length < maxItems) {
    const data = await graphql(
      `query($projectId: ID!, $first: Int!, $after: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: $first, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                fieldValues(first: 12) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                  }
                }
                content {
                  ... on DraftIssue { title body }
                  ... on Issue { title body }
                }
              }
            }
          }
        }
      }`,
      { projectId, first: pageSize, after: cursor }
    );
    const items = data?.node?.items;
    if (!items) break;
    const nodes = items.nodes ?? [];
    for (const node of nodes) {
      if (!node || !node.id) continue;
      let title = "";
      let body = "";
      if (node.content) {
        title = node.content.title ?? "";
        body = node.content.body ?? "";
      }
      let statusName = "Todo";
      const fieldValues = node.fieldValues?.nodes ?? [];
      for (const fv of fieldValues) {
        if (fv && fv.field?.name === "Status" && fv.name) {
          statusName = fv.name;
          break;
        }
      }
      out.push({
        id: node.id,
        title: title.trim() || "(No title)",
        description: body ? body.trim() : null,
        statusName,
      });
    }
    if (!items.pageInfo?.hasNextPage) break;
    cursor = items.pageInfo.endCursor;
    if (!cursor) break;
  }
  return out.slice(0, maxItems);
}

/**
 * Map GitHub Status label to our status.
 */
function githubStatusToApp(statusName) {
  if (!statusName || typeof statusName !== "string") return "todo";
  const key = statusName.toLowerCase().trim();
  return STATUS_TO_APP[key] ?? "todo";
}

module.exports = {
  getConfig,
  getProjectId,
  createDraftIssue,
  updateItemStatus,
  listProjectItems,
  githubStatusToApp,
};
