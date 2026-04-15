/**
 * Integrations Module
 * Handles storage of API keys and simulators for external tools.
 */

const INT_KEY = 'ua_integrations';

const DEFAULT_INTEGRATIONS = {
  jira: { connected: false, token: '', domain: '', project: '' },
  github: { connected: false, token: '', repo: '' },
  slack: { connected: false, webhook: '' },
  google: { connected: false, token: '' }
};

export function getIntegrations() {
  const raw = localStorage.getItem(INT_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_INTEGRATIONS;
}

export function saveIntegration(key, data) {
  const all = getIntegrations();
  all[key] = { ...all[key], ...data };
  localStorage.setItem(INT_KEY, JSON.stringify(all));
}

export function disconnectIntegration(key) {
  const all = getIntegrations();
  all[key] = { ...DEFAULT_INTEGRATIONS[key] };
  localStorage.setItem(INT_KEY, JSON.stringify(all));
}

/**
 * Simulates fetching Jira blockers for the given project.
 * Real implementation would use fetch() with Basic Auth (Base64 token).
 */
export async function syncJiraData() {
  const { jira } = getIntegrations();
  if (!jira.connected) return null;
  
  // Simulation: Wait 1s and return mock blockers
  await new Promise(r => setTimeout(r, 1200));
  
  return {
    blockers: [
      { id: 'PROJ-101', summary: 'API Gateway timeout issues in Staging', priority: 'High' },
      { id: 'PROJ-124', summary: 'Missing documentation for auth-service', priority: 'Medium' }
    ],
    velocity: '14 pts / sprint (Stable)'
  };
}

/**
 * Simulates fetching GitHub trends.
 */
export async function syncGitHubData() {
  const { github } = getIntegrations();
  if (!github.connected) return null;
  
  await new Promise(r => setTimeout(r, 1000));
  
  return {
    pullRequests: 8,
    lastCommit: '2 hours ago by @santanu',
    trends: 'Increased PR volume this week'
  };
}

/**
 * Posts to Slack via Webhook.
 */
export async function publishToSlack(content) {
  const { slack } = getIntegrations();
  if (!slack.connected || !slack.webhook) throw new Error('Slack not connected');
  
  // Real implementation:
  // return fetch(slack.webhook, { method: 'POST', body: JSON.stringify({ text: content }) });
  
  console.log('Published to Slack:', content);
  return true;
}
