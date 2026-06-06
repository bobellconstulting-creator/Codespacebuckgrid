// npm install @supabase/supabase-js

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Client initialization
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------

export interface WLProperty {
  id: string;
  user_id: string;
  name: string;
  boundary_geojson: any; // GeoJSON polygon
  acres: number | null;
  state: string | null;
  county: string | null;
  created_at: string;
  updated_at: string;
}

export interface WLTonySession {
  id: string;
  property_id: string;
  messages: any[]; // the chat history
  zones_placed: any[]; // Tony zones from that session
  created_at: string;
}

// ---------------------------------------------------------------------------
// Property functions
// ---------------------------------------------------------------------------

export async function saveProperty(
  property: Partial<WLProperty>
): Promise<WLProperty | null> {
  if (!supabase) return null;

  const now = new Date().toISOString();
  const payload = { ...property, updated_at: now };

  const { data, error } = await supabase
    .from("wl_properties")
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error("[supabase] saveProperty error:", error.message);
    return null;
  }

  return data as WLProperty;
}

export async function getProperty(id: string): Promise<WLProperty | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("wl_properties")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[supabase] getProperty error:", error.message);
    return null;
  }

  return data as WLProperty;
}

export async function getPropertiesForUser(
  userId: string
): Promise<WLProperty[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("wl_properties")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[supabase] getPropertiesForUser error:", error.message);
    return [];
  }

  return (data ?? []) as WLProperty[];
}

// ---------------------------------------------------------------------------
// Tony session functions
// ---------------------------------------------------------------------------

export async function saveTonySession(
  session: Partial<WLTonySession>
): Promise<WLTonySession | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("wl_tony_sessions")
    .upsert(session)
    .select()
    .single();

  if (error) {
    console.error("[supabase] saveTonySession error:", error.message);
    return null;
  }

  return data as WLTonySession;
}

export async function getSessionsForProperty(
  propertyId: string
): Promise<WLTonySession[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("wl_tony_sessions")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[supabase] getSessionsForProperty error:", error.message);
    return [];
  }

  return (data ?? []) as WLTonySession[];
}

/*
 * ---------------------------------------------------------------------------
 * SQL Schema Reference
 * ---------------------------------------------------------------------------
 *
 * -- Properties table
 * CREATE TABLE wl_properties (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id TEXT NOT NULL,
 *   name TEXT NOT NULL DEFAULT 'My Property',
 *   boundary_geojson JSONB NOT NULL,
 *   acres FLOAT,
 *   state TEXT,
 *   county TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Tony sessions
 * CREATE TABLE wl_tony_sessions (
 *   id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
 *   property_id UUID REFERENCES wl_properties(id) ON DELETE CASCADE,
 *   messages JSONB DEFAULT '[]',
 *   zones_placed JSONB DEFAULT '[]',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- RLS: users can only see their own properties
 * ALTER TABLE wl_properties ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "own_properties" ON wl_properties FOR ALL USING (user_id = auth.uid()::text);
 * ---------------------------------------------------------------------------
 */
