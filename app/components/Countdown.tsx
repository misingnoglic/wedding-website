"use client";

import { useState, useEffect } from 'react';

// December 12, 2026 at 4:00 PM Mexican Pacific Standard Time (UTC-7) = 23:00:00 UTC
const TARGET_UTC_MS = Date.UTC(2026, 11, 12, 23, 0, 0);

function addMonthsUTC(date: Date, count: number): Date {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const ms = date.getUTCMilliseconds();

    const targetMonth = month + count;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;

    // Clamp day to max days in target month
    const maxDays = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(day, maxDays);

    return new Date(Date.UTC(targetYear, normalizedMonth, clampedDay, hours, minutes, seconds, ms));
}

interface TimeLeft {
    months: number;
    days: number;
    hours: number;
    minutes: number;
}

export default function Countdown() {
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

    useEffect(() => {
        const calculateTimeLeft = (): TimeLeft => {
            const nowMs = Date.now();

            if (nowMs >= TARGET_UTC_MS) {
                return { months: 0, days: 0, hours: 0, minutes: 0 };
            }

            const current = new Date(nowMs);
            let months = 0;

            while (true) {
                const nextMonth = addMonthsUTC(current, months + 1);
                if (nextMonth.getTime() <= TARGET_UTC_MS) {
                    months++;
                } else {
                    break;
                }
            }

            const currentAfterMonths = addMonthsUTC(current, months);
            let remainingMs = TARGET_UTC_MS - currentAfterMonths.getTime();

            const msPerDay = 1000 * 60 * 60 * 24;
            const msPerHour = 1000 * 60 * 60;
            const msPerMinute = 1000 * 60;

            const days = Math.floor(remainingMs / msPerDay);
            remainingMs -= days * msPerDay;

            const hours = Math.floor(remainingMs / msPerHour);
            remainingMs -= hours * msPerHour;

            const minutes = Math.floor(remainingMs / msPerMinute);

            return { months, days, hours, minutes };
        };

        setTimeLeft(calculateTimeLeft());

        // Update every second to keep minutes and hours accurate
        const interval = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // SSR fallback to prevent hydration mismatch
    if (!timeLeft) {
        return <div className="h-6"></div>; // Placeholder space
    }

    if (
        timeLeft.months === 0 &&
        timeLeft.days === 0 &&
        timeLeft.hours === 0 &&
        timeLeft.minutes === 0
    ) {
        return null; // Remove entirely when it's reached
    }

    return (
        <div className="font-karla text-sage tracking-widest uppercase text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 flex-wrap mt-2">
            {timeLeft.months > 0 && (
                <>
                    <span>{timeLeft.months} {timeLeft.months === 1 ? 'Month' : 'Months'}</span>
                    <span className="text-zinc-300">•</span>
                </>
            )}
            {(timeLeft.months > 0 || timeLeft.days > 0) && (
                <>
                    <span>{timeLeft.days} {timeLeft.days === 1 ? 'Day' : 'Days'}</span>
                    <span className="text-zinc-300">•</span>
                </>
            )}
            {(timeLeft.months > 0 || timeLeft.days > 0 || timeLeft.hours > 0) && (
                <>
                    <span>{timeLeft.hours} {timeLeft.hours === 1 ? 'Hour' : 'Hours'}</span>
                    <span className="text-zinc-300">•</span>
                </>
            )}
            <span>{timeLeft.minutes} {timeLeft.minutes === 1 ? 'Minute' : 'Minutes'}</span>
        </div>
    );
}


