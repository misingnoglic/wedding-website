import { getAuthenticatedFamily } from '@/lib/auth'
import AccountView from './AccountView'

export default async function AccountPage() {
  const family = await getAuthenticatedFamily('/account')

  return (
    <div className="w-full max-w-4xl px-4 flex-grow py-8 md:py-12 flex flex-col items-center mx-auto animate-fade-in">
      <div className="w-full text-center mb-6">
        <h1 className="text-5xl md:text-7xl font-script mb-4">Account</h1>
      </div>

      <AccountView family={family} />
    </div>
  )
}
