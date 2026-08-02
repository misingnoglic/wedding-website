'use client'

import { useEffect } from 'react'

export default function ConsoleEasterEgg() {
  useEffect(() => {
    // Print the welcome message in the console
    console.log(
      `❤️ Arya & Christa's Wedding ❤️
-----------------------------------------
Don't poke around too hard. 
Find any bugs? Let me know. 
For a fun surprise, type arya.propose(christa)`
    )

    // Set up window.christa and window.arya for interactive console easter egg
    if (typeof window !== 'undefined') {
      ; (window as any).christa = 'Christa'
        ; (window as any).arya = {
          propose: (target?: any) => {
            const isChrista = target === (window as any).christa
            if (isChrista) {
              const promise = Promise.resolve('YES! 💍') as Promise<string> & {
                '<wedding>'?: string
              }
              promise['<wedding>'] = 'pending'
              return promise
            }

            const promise = Promise.reject('Sorry, he\'s taken!') as Promise<never> & {
              '<wedding>'?: string
            }
            promise['<wedding>'] = 'rejected'
            promise.catch(() => { })
            return promise
          },
        }
    }
  }, [])

  return null
}
