import { Metadata } from 'next'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { getInboxThreads } from '@/lib/inbox'
import { getPhoneKey } from '@/lib/phone'
import { getPhoneProblems } from '@/lib/sms'
import { endpointFromColumns } from '@/lib/seating'
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

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; phone?: string }> }) {
  const { tab, phone } = await searchParams
  // Secret access: If not logged in as admin, triggers Next.js notFound() (404)
  const adminFamily = await getAuthenticatedAdmin()

  // Fetch all families and their guests
  const familyRows = await db.family.findMany({
    include: {
      guests: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: { name: 'asc' },
  })

  // Flag guests whose number keeps failing so we know to ask for a new one
  const phoneProblems = await getPhoneProblems()
  const families = familyRows.map((f) => ({
    ...f,
    guests: f.guests.map((g) => ({
      ...g,
      phoneProblem: (g.phoneNumber && phoneProblems.get(getPhoneKey(g.phoneNumber))) || null,
    })),
  }))

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

  const inboxThreads = await getInboxThreads()

  const [seatingGroups, linkRows, relationships] = await Promise.all([
    db.seatingGroup.findMany({
      include: { members: { select: { guestId: true } } },
      orderBy: { name: 'asc' },
    }),
    db.seatingLink.findMany(),
    db.guestRelationship.findMany({
      select: { guestAId: true, guestBId: true, affinity: true, constraint: true, note: true },
    }),
  ])
  const seating = {
    groups: seatingGroups.map(({ members, ...g }) => ({ ...g, memberIds: members.map((m) => m.guestId) })),
    links: linkRows.flatMap((l) => {
      const a = endpointFromColumns(l.aGroupId, l.aFamilyId, l.aGuestId)
      const b = endpointFromColumns(l.bGroupId, l.bFamilyId, l.bGuestId)
      return a && b ? [{ a, b, affinity: l.affinity }] : []
    }),
    relationships,
  }

  return (
    <div className="w-full flex-grow flex flex-col animate-fade-in">
      <AdminDashboard
        initialFamilies={families}
        currentAdmin={adminFamily}
        initialAuditEvents={auditEvents}
        initialThreads={inboxThreads}
        seating={seating}
        initialTab={tab === 'messages' || tab === 'seating' ? tab : undefined}
        initialPhone={phone}
      />
    </div>
  )
}
