'use client'

import React from 'react'

export default function BuckGridLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shield background */}
      <path d="M60 6L108 28V68C108 90 88 108 60 116C32 108 12 90 12 68V28L60 6Z" fill="#0F1A0F" stroke="#C8A55C" strokeWidth="2.5"/>
      {/* Inner shield line */}
      <path d="M60 14L100 32V68C100 86 83 101 60 108C37 101 20 86 20 68V32L60 14Z" fill="none" stroke="rgba(200,165,92,0.25)" strokeWidth="1"/>
      {/* Antler left */}
      <path d="M38 62C38 62 30 48 28 40C26 32 30 24 30 24" stroke="#C8A55C" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M32 46C32 46 24 42 20 38" stroke="#C8A55C" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M30 36C30 36 22 34 18 30" stroke="#C8A55C" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M34 54C34 54 26 54 22 52" stroke="#C8A55C" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Antler right */}
      <path d="M82 62C82 62 90 48 92 40C94 32 90 24 90 24" stroke="#C8A55C" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M88 46C88 46 96 42 100 38" stroke="#C8A55C" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M90 36C90 36 98 34 102 30" stroke="#C8A55C" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M86 54C86 54 94 54 98 52" stroke="#C8A55C" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Grid crosshairs */}
      <line x1="45" y1="60" x2="75" y2="60" stroke="#C8A55C" strokeWidth="1" opacity="0.5"/>
      <line x1="60" y1="45" x2="60" y2="75" stroke="#C8A55C" strokeWidth="1" opacity="0.5"/>
      {/* Center circle */}
      <circle cx="60" cy="60" r="8" fill="none" stroke="#C8A55C" strokeWidth="1.5"/>
      <circle cx="60" cy="60" r="3" fill="#C8A55C"/>
      {/* BUCK text */}
      <text x="60" y="88" textAnchor="middle" fill="#C8A55C" fontSize="11" fontWeight="900" fontFamily="serif" letterSpacing="4">BUCK</text>
      {/* GRID text */}
      <text x="60" y="99" textAnchor="middle" fill="#8B7A4A" fontSize="8" fontWeight="700" fontFamily="sans-serif" letterSpacing="6">GRID</text>
    </svg>
  )
}
