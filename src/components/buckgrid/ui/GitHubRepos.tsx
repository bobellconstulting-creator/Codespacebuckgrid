'use client'

import React, { useEffect, useState } from 'react'

interface Repo {
  id: number
  name: string
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
  updated_at: string
}

export default function GitHubRepos() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/github/repos')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRepos(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 1000 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'rgba(20,20,20,0.85)', border: '1px solid #333', borderRadius: 8,
          color: '#FF6B00', fontWeight: 900, fontSize: 11, padding: '8px 14px',
          cursor: 'pointer', letterSpacing: 1,
        }}
      >
        {open ? 'CLOSE REPOS' : 'GITHUB REPOS'}
      </button>

      {open && (
        <div className="glass" style={{
          marginTop: 6, width: 300, maxHeight: '70vh', overflowY: 'auto',
          borderRadius: 12, padding: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#FF6B00', marginBottom: 8, letterSpacing: 1 }}>
            ALL REPOSITORIES
          </div>
          {loading && <div style={{ color: '#888', fontSize: 12 }}>Loading...</div>}
          {repos.map(repo => (
            <a
              key={repo.id}
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', padding: '8px 10px', marginBottom: 4,
                background: 'rgba(255,107,0,0.08)', borderRadius: 8,
                textDecoration: 'none', border: '1px solid rgba(255,107,0,0.15)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{repo.name}</div>
              {repo.description && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{repo.description}</div>
              )}
              <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                {repo.language && <span style={{ color: '#FF6B00', marginRight: 10 }}>{repo.language}</span>}
                ★ {repo.stargazers_count}
              </div>
            </a>
          ))}
          {!loading && repos.length === 0 && (
            <div style={{ color: '#888', fontSize: 12 }}>No repositories found.</div>
          )}
        </div>
      )}
    </div>
  )
}
