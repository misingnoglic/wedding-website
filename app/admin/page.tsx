import { Metadata } from 'next'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import AdminDashboard from './AdminDashboard'

export const metadata: Metadata = {
  title: 'RSVP Master Dashboard | Arya & Christa',
  description: 'Admin overview of all wedding guest RSVPs, dietary needs, and travel arrangements.',
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPage() {
  // Secret access: If not logged in as admin, triggers Next.js notFound() (404)
  const adminFamily = await getAuthenticatedAdmin()

  // Fetch all families and their guests
  const families = await db.family.findMany({
    include: {
      guests: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Fetch recent activity audit logs
  const auditEvents = await db.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      family: {
        select: { id: true, name: true },
      },
    },
  })

  // Fetch incoming SMS messages
  const smsMessages = await db.smsMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      guest: {
        include: {
          family: {
            select: { id: true, name: true, password: true },
          },
        },
      },
      family: {
        select: { id: true, name: true, password: true },
      },
    },
  })

  return (
    <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex-grow py-8 md:py-12 flex flex-col mx-auto animate-fade-in">
      <AdminDashboard
        initialFamilies={families}
        currentAdmin={adminFamily}
        initialAuditEvents={auditEvents}
        initialMessages={smsMessages}
      />
    </div>
  )
}
