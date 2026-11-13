import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ReactNode, useEffect } from 'react'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import { ForgotPassword, Login, Register, ResetPassword, VerifyEmail } from './pages/Auth'
import Landing from './pages/Landing'
import Pricing from './pages/Pricing'
import Dashboard from './pages/Dashboard'
import ApiKeys from './pages/ApiKeys'
import Send from './pages/Send'
import Messages from './pages/Messages'
import Contacts from './pages/Contacts'
import Campaigns from './pages/Campaigns'
import OptOuts from './pages/OptOuts'
import Plans from './pages/Plans'
import SmsActivation from './pages/SmsActivation'
import Team from './pages/Team'
import Docs from './pages/Docs'
import Admin from './pages/Admin'

function Protected({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (staff && !user.isStaff) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

/** `/` is the public landing page for visitors and the dashboard for signed-in users. */
function Home() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? <Layout><Dashboard /></Layout> : <Landing />
}

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  const { user } = useAuth()
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/send" element={<Protected><Send /></Protected>} />
        <Route path="/campaigns" element={<Protected><Campaigns /></Protected>} />
        <Route path="/contacts" element={<Protected><Contacts /></Protected>} />
        <Route path="/messages" element={<Protected><Messages /></Protected>} />
        <Route path="/opt-outs" element={<Protected><OptOuts /></Protected>} />
        <Route path="/api-keys" element={<Protected><ApiKeys /></Protected>} />
        <Route path="/docs" element={<Protected><Docs /></Protected>} />
        <Route path="/plans" element={<Protected><Plans /></Protected>} />
        <Route path="/sms-activation" element={<Protected><SmsActivation /></Protected>} />
        <Route path="/team" element={<Protected><Team /></Protected>} />
        <Route path="/admin" element={<Protected staff><Admin /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
