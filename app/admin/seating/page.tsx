import { Metadata } from 'next'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { endpointFromColumns } from '@/lib/seating'
import SeatingLab from './SeatingLab'
import { LabConfig, LabData, LabPlan } from './types'

export const metadata: Metadata = {
  title: 'Seating Lab | Arya & Christa',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function SeatingLabPage() {
  await getAuthenticatedAdmin()

  const [families, groups, linkRows, relationships, plans, settings] = await Promise.all([
    db.family.findMany({ include: { guests: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } }, orderBy: { name: 'asc' } }),
    db.seatingGroup.findMany({ include: { members: { select: { guestId: true } } }, orderBy: { name: 'asc' } }),
    db.seatingLink.findMany(),
    db.guestRelationship.findMany({ select: { guestAId: true, guestBId: true, affinity: true, constraint: true } }),
    db.seatingPlan.findMany({
      include: { assignments: { select: { seatKey: true, guestId: true, isLocked: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    db.seatingSettings.findUnique({ where: { id: 'default' } }),
  ])

  const data: LabData = {
    guests: families.flatMap((f) =>
      f.guests.map((g) => ({
        id: g.id,
        name: g.name,
        familyId: f.id,
        familyName: f.name,
        excludeFromSeating: g.excludeFromSeating,
        isAttendingWedding: g.isAttendingWedding,
        seatRequirement: g.seatRequirement,
      }))
    ),
    groups: groups.map(({ members, ...g }) => ({ id: g.id, name: g.name, affinity: g.affinity, memberIds: members.map((m) => m.guestId) })),
    links: linkRows.flatMap((l) => {
      const a = endpointFromColumns(l.aGroupId, l.aFamilyId, l.aGuestId)
      const b = endpointFromColumns(l.bGroupId, l.bFamilyId, l.bGuestId)
      return a && b ? [{ a, b, affinity: l.affinity }] : []
    }),
    relationships,
    plans: plans.map(
      (p): LabPlan => ({
        id: p.id,
        name: p.name,
        source: p.source,
        score: p.score,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        config: p.config as LabPlan['config'],
        params: p.params as LabPlan['params'],
        assignments: p.assignments,
      })
    ),
    settings: (settings?.config as Partial<LabConfig> | undefined) ?? null,
  }

  return <SeatingLab data={data} />
}
