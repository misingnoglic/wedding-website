'use client'

import { useState } from 'react'
import { FlatGuest } from '../../types'

interface SongsTabProps {
  guests: FlatGuest[]
}

export default function SongsTab({ guests }: SongsTabProps) {
  const [copiedSongs, setCopiedSongs] = useState(false)

  const songGuests = guests.filter(
    (g) => g.songRequests && g.songRequests.trim().length > 0
  )

  const handleCopyPlaylist = () => {
    const list = songGuests
      .map((g) => `${g.songRequests} (requested by ${g.name})`)
      .join('\n')
    navigator.clipboard.writeText(list)
    setCopiedSongs(true)
    setTimeout(() => setCopiedSongs(false), 2500)
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 pb-4">
        <div>
          <h3 className="text-xl font-sans text-black">DJ Song Requests</h3>
          <p className="text-xs font-karla text-zinc-500">
            {songGuests.length} dance floor request(s) submitted by guests
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyPlaylist}
          disabled={songGuests.length === 0}
          className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-sans uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
        >
          {copiedSongs ? '✓ Copied to Clipboard!' : 'Copy DJ Tracklist'}
        </button>
      </div>

      {songGuests.length === 0 ? (
        <p className="text-zinc-400 font-karla text-xs py-8 text-center">
          No song requests have been submitted yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {songGuests.map((g) => (
            <div
              key={g.id}
              className="p-4 bg-purple-50/40 rounded-xl border border-purple-200/60 flex items-start gap-3"
            >
              <div className="p-2 bg-purple-100 rounded-lg text-purple-700 text-sm">🎵</div>
              <div className="flex-1">
                <div className="font-semibold text-black text-sm">&ldquo;{g.songRequests}&rdquo;</div>
                <div className="text-xs font-karla text-purple-900/70 mt-1">
                  Requested by <strong className="text-purple-950">{g.name}</strong> ({g.familyName})
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
