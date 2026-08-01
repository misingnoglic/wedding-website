import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { db } from '@/lib/db'

export async function getOptionalAuthenticatedFamily() {
  const cookieStore = await cookies()
  const familyId = cookieStore.get('rsvp_family_id')?.value

  if (!familyId) {
    return null
  }

  try {
    const family = await db.family.findUnique({
      where: { id: familyId },
      include: {
        guests: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    return family
  } catch (error) {
    console.error('Failed to fetch authenticated family:', error)
    return null
  }
}

export async function getAuthenticatedFamily(redirectPath: string = '/rsvp') {
  const family = await getOptionalAuthenticatedFamily()

  if (!family) {
    const encodedRedirect = encodeURIComponent(redirectPath)
    redirect(`/login?redirect=${encodedRedirect}`)
  }

  return family
}

export async function getAuthenticatedAdmin() {
  const family = await getOptionalAuthenticatedFamily()

  if (!family || !family.isAdmin) {
    notFound()
  }

  return family
}
