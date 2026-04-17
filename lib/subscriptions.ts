// Subscription persistence layer.
//
// Stores subscriber email → customer_id + status in a flat JSON file at
// data/subscribers.json.  File-based because the project has no auth/DB yet.
// Swap this module for a Prisma/DB implementation later without touching routes.

import fs from 'fs'
import path from 'path'

export interface Subscriber {
  email: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  status: 'active' | 'canceled' | 'past_due'
  createdAt: string
  updatedAt: string
}

type SubscriberMap = Record<string, Subscriber>

const DATA_FILE = path.join(process.cwd(), 'data', 'subscribers.json')

function ensureDataDir(): void {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readAll(): SubscriberMap {
  ensureDataDir()
  if (!fs.existsSync(DATA_FILE)) return {}
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    return JSON.parse(raw) as SubscriberMap
  } catch {
    return {}
  }
}

function writeAll(data: SubscriberMap): void {
  ensureDataDir()
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8')
}

export function upsertSubscriber(sub: Subscriber): void {
  const all = readAll()
  const updated: SubscriberMap = {
    ...all,
    [sub.email.toLowerCase()]: {
      ...sub,
      email: sub.email.toLowerCase(),
      updatedAt: new Date().toISOString(),
    },
  }
  writeAll(updated)
}

export function isSubscribed(email: string): boolean {
  const all = readAll()
  const record = all[email.toLowerCase()]
  return record?.status === 'active'
}

export function getSubscriber(email: string): Subscriber | null {
  const all = readAll()
  return all[email.toLowerCase()] ?? null
}
