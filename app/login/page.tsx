import { redirect } from 'next/navigation'
import { getOptionalAuthenticatedFamily } from '@/lib/auth'
import LoginForm from '@/app/rsvp/LoginForm'

interface LoginPageProps {
  searchParams: Promise<{
    redirect?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect: redirectParam } = await searchParams
  const safeRedirect = (redirectParam && redirectParam.startsWith('/')) ? redirectParam : '/rsvp'

  // If already logged in, redirect straight to target page
  const family = await getOptionalAuthenticatedFamily()
  if (family) {
    redirect(safeRedirect)
  }

  const isAccountRedirect = safeRedirect.startsWith('/account')

  return (
    <div className="w-full max-w-4xl px-4 flex-grow py-8 md:py-16 flex flex-col items-center mx-auto animate-fade-in">
      <div className="w-full text-center mb-8">
        <h1 className="text-5xl md:text-7xl font-script mb-6">
          {isAccountRedirect ? 'Account Access' : 'Guest Login'}
        </h1>
        <p className="text-zinc-600 font-karla text-lg max-w-xl mx-auto">
          Please enter the password provided on your invitation to access your details.
        </p>
      </div>

      <LoginForm
        redirectUrl={safeRedirect}
        title={isAccountRedirect ? 'Manage Account' : 'Welcome'}
        subtitle={isAccountRedirect ? 'Enter your code to manage your party and settings' : 'Enter your code to access RSVP and travel information'}
        buttonText="Sign In"
      />
    </div>
  )
}
