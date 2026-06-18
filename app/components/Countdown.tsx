"use client";

import { useState, useEffect } from 'react';

export default function Countdown() {
    const [timeLeft, setTimeLeft] = useState<{ months: number; days: number } | null>(null);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            // Localized to user's timezone: this uses the local time for midnight on Dec 12, 2026
            const targetDate = new Date(2026, 11, 12); 

            if (now >= targetDate) {
                return { months: 0, days: 0 };
            }

            let current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

            let months = 0;
            
            while (true) {
                // Advance by 1 month
                const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
                if (nextMonth <= targetMidnight) {
                    months++;
                    current = nextMonth;
                } else {
                    break;
                }
            }
            
            const msPerDay = 1000 * 60 * 60 * 24;
            const utcCurrent = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
            const utcTarget = Date.UTC(targetMidnight.getFullYear(), targetMidnight.getMonth(), targetMidnight.getDate());
            const days = Math.floor((utcTarget - utcCurrent) / msPerDay);

            return { months, days };
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
        // @ts-ignore
        setTimeLeft(calculateTimeLeft());

        // Update every hour
        const interval = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000 * 60 * 60);

        return () => clearInterval(interval);
    }, []);

    // SSR fallback to prevent hydration mismatch
    if (!timeLeft) {
        return <div className="h-6"></div>; // Placeholder space
    }

    if (timeLeft.months === 0 && timeLeft.days === 0) {
        return null; // Remove entirely when it's 12/12
    }

    return (
        <div className="font-karla text-sage tracking-widest uppercase text-sm font-semibold flex items-center justify-center gap-2 mt-2">
            {timeLeft.months > 0 && (
                <>
                    <span>{timeLeft.months} {timeLeft.months === 1 ? 'Month' : 'Months'}</span>
                    <span className="text-zinc-300">•</span>
                </>
            )}
            <span>{timeLeft.days} {timeLeft.days === 1 ? 'Day' : 'Days'}</span>
        </div>
    );
}
