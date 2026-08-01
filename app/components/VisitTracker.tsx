'use client'

import { useEffect } from 'react'
import { recordFamilyVisit } from '@/app/actions/visit'

const STORAGE_KEY = 'wedding_last_visit_log'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export default function VisitTracker() {
  useEffect(() => {
    try {
      const lastRecordedStr = localStorage.getItem(STORAGE_KEY)
      const now = Date.now()

      if (lastRecordedStr) {
        const lastRecorded = parseInt(lastRecordedStr, 10)
        if (!isNaN(lastRecorded) && now - lastRecorded < ONE_DAY_MS) {
          // Visited within the past 24 hours
          return
        }
      }

      recordFamilyVisit()
        .then((res) => {
          if (res?.logged || res?.reason === 'already_recorded_within_24h') {
            localStorage.setItem(STORAGE_KEY, now.toString())
          }
        })
        .catch(() => {
          // Silent catch
        })
    } catch {
      // Fallback if localStorage is disabled in browser
    }
  }, [])

  return null
}
