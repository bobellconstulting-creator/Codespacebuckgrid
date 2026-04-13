import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedEntry {
  agentName: string
  message: string
  timestamp: number
  raw: string
}

interface FeedResponse {
  entries: FeedEntry[]
  readAt: number
}

// ─── Parser ───────────────────────────────────────────────────────────────────

// FLEET-FEED.md format:
//   ## YYYY-MM-DD [HH:MM] — <agent> — <type>
//   <body lines>
//   ---
//
// The header date may be "YYYY-MM-DD" or "YYYY-MM-DD HH:MM".
// The section terminates at the next "## " heading or "---" separator.

const ENTRY_RE = /^## (\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)\s+[—-]+\s+(\S+)\s+[—-]+\s+\S+\s*\n([\s\S]*?)(?=^## |\Z)/gm

function parseTimestamp(raw: string): number {
  const normalized = raw.trim()
  const ts = Date.parse(normalized)
  return isNaN(ts) ? 0 : ts
}

function parseFeedEntries(content: string, fileMtime: number): FeedEntry[] {
  const entries: FeedEntry[] = []
  ENTRY_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = ENTRY_RE.exec(content)) !== null) {
    const [raw, dateStr, agentName, body] = match

    const trimmedBody = body
      .split('\n')
      .map(l => l.trimEnd())
      // Drop trailing separator lines
      .filter(l => l !== '---')
      .join('\n')
      .trim()

    if (!trimmedBody) continue

    const timestamp = parseTimestamp(dateStr) || fileMtime

    entries.push({
      agentName: agentName.trim(),
      message: trimmedBody,
      timestamp,
      raw: raw.trim(),
    })
  }

  return entries
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<FeedResponse>> {
  const feedPath = path.normalize(
    process.env.FLEET_FEED_PATH ?? 'C:/Users/bobel/.openclaw/FLEET-FEED.md'
  )

  const readAt = Date.now()

  if (!fs.existsSync(feedPath)) {
    return NextResponse.json({ entries: [], readAt })
  }

  let content: string
  let fileMtime: number

  try {
    const stat = fs.statSync(feedPath)
    fileMtime = stat.mtimeMs
    content = fs.readFileSync(feedPath, 'utf-8')
  } catch {
    return NextResponse.json({ entries: [], readAt })
  }

  const allEntries = parseFeedEntries(content, fileMtime)

  // Return most recent 20, newest first
  const entries = allEntries
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)

  return NextResponse.json({ entries, readAt })
}
