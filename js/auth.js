/**
 * auth.js — Supabase Authentication Logic
 * Handles login, logout, and auth state monitoring.
 */

// We store these in localStorage so the user can connect their own Supabase project
const STORAGE_PREFIX = 'unblocked_supabase_';

export function getSupabaseConfig() {
  return {
    url: localStorage.getItem(STORAGE_PREFIX + 'url') || '',
    key: localStorage.getItem(STORAGE_PREFIX + 'anon_key') || ''
  };
}

export function setSupabaseConfig(url, key) {
  localStorage.setItem(STORAGE_PREFIX + 'url', url.trim());
  localStorage.setItem(STORAGE_PREFIX + 'anon_key', key.trim());
  // Reloading to re-initialize supabase
  window.location.reload();
}

let supabase = null;

function initSupabase() {
  const config = getSupabaseConfig();
  if (config.url && config.key && window.supabase) {
    supabase = window.supabase.createClient(config.url, config.key);
  }
}

// Initialize on load
initSupabase();

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
}

export async function signInWithGitHub() {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {}; 
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user || null);
  });
  return () => subscription.unsubscribe();
}

export function isAuthEnabled() {
  return !!supabase;
}
