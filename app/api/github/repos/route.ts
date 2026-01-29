import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.github.com/users/bobellconstulting-creator/repos?per_page=100&sort=updated', {
      headers: { Accept: 'application/vnd.github.v3+json' },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
    const repos = await res.json()
    return NextResponse.json(repos)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
