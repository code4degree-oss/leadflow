import { useState, useEffect } from 'react'
import { requestForToken, onMessageListener } from '../utils/firebase'
import { fetchWithAuth } from '../utils/api'
import SubscriptionBanner from './SubscriptionBanner'
import NotificationDropdown from './NotificationDropdown'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard, Users, Upload, BarChart2, Settings,
  Bell, Search, ChevronDown, LogOut, Building2,
  Phone, MapPin, ShieldCheck, Database, CreditCard,
  Briefcase, Calendar, Activity, FileText, Flame, Globe,
  Menu, X, Ban, Mail
} from 'lucide-react'
import clsx from 'clsx'


const navConfig = {
  superadmin: {
    label: 'Super Admin',
    color: '#8B6CF7',
    items: [
      { icon: LayoutDashboard, label: 'Platform Overview', href: '/superadmin' },
      { icon: Building2,       label: 'Client Accounts',  href: '/superadmin/clients' },
      { icon: CreditCard,      label: 'Billing & Plans',  href: '/superadmin/billing' },
      { icon: Database,        label: 'Storage & Quotas', href: '/superadmin/storage' },
      { icon: Globe,           label: 'Feature Flags',    href: '/superadmin/features' },
      { icon: FileText,        label: 'Data Exports',     href: '/superadmin/exports' },
      { icon: Settings,        label: 'System Config',    href: '/superadmin/system-config' },
    ]
  },
  admin: {
    label: 'Client Admin',
    color: '#4F8EF7',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',        href: '/admin' },
      { icon: Upload,          label: 'Lead Upload',      href: '/admin/upload' },
      { icon: Users,           label: 'Lead Management',  href: '/admin/leads' },
      { icon: Flame,           label: 'Hot Leads',        href: '/admin/hot' },
      { icon: Users,           label: 'Employees',        href: '/admin/employees' },
      { icon: Briefcase,       label: 'Projects',         href: '/admin/projects' },
      { icon: BarChart2,       label: 'Performance',      href: '/admin/performance' },
      { icon: Activity,        label: 'Login Activity',   href: '/admin/audit' },
      { icon: Settings,        label: 'Settings',         href: '/admin/settings' },
    ]
  },
  telecaller: {
    label: 'Telecaller',
    color: '#00D4AA',
    items: [
      { icon: LayoutDashboard, label: 'My Dashboard',     href: '/telecaller' },
      { icon: Phone,           label: 'My Leads',         href: '/telecaller/leads' },
      { icon: Flame,           label: 'Hot Leads',        href: '/telecaller/hot' },
      { icon: Calendar,        label: 'Reminders',        href: '/telecaller/reminders' },
      { icon: Briefcase,       label: 'Projects',         href: '/telecaller/projects' },
      { icon: BarChart2,       label: 'My Performance',   href: '/telecaller/performance' },
    ]
  },
  fieldagent: {
    label: 'Field Agent',
    color: '#F5A623',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',        href: '/fieldagent' },
      { icon: Calendar,        label: 'Site Visits',      href: '/fieldagent/visits' },
      { icon: MapPin,          label: 'Completed Visits', href: '/fieldagent/completed' },
      { icon: BarChart2,       label: 'My Stats',         href: '/fieldagent/stats' },
    ]
  }
}

export default function Layout({ children, role = 'admin', pageTitle = '', actions }) {
  const router = useRouter()
  const config = navConfig[role]
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isInactive, setIsInactive] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    // Load user info from localStorage
    const firstName = localStorage.getItem('user_first_name') || ''
    const lastName = localStorage.getItem('user_last_name') || ''
    const email = localStorage.getItem('user_email') || ''
    setUserName(firstName && lastName ? `${firstName} ${lastName}` : (firstName || email.split('@')[0]))
    setUserEmail(email)

    if (role !== 'superadmin') {
      const subActive = localStorage.getItem('subscription_active')
      setIsInactive(subActive === 'false')
    }

    // Register Push Notifications
    const setupNotifications = async () => {
      try {
        const token = await requestForToken();
        if (token) {
          await fetchWithAuth('/accounts/device-token/', {
            method: 'POST',
            body: JSON.stringify({ token, device_type: 'web' })
          });
          onMessageListener().then(payload => {
            console.log('Received foreground message: ', payload);
            // Optionally, we could show a toast here in the future
          }).catch(err => console.log('failed: ', err));
        }
      } catch (err) {
        console.log('Error registering push notifications:', err);
      }
    };
    
    // Only ask if they are logged in and it's a browser
    if (localStorage.getItem('access_token')) {
      setupNotifications();
    }

  }, [role])

  const handleLogout = () => {
    localStorage.clear()
    router.push('/login')
  }

  const roleColors = {
    superadmin: 'bg-purple/10 text-purple border-purple/20',
    admin: 'bg-accent/10 text-accent border-accent/20',
    telecaller: 'bg-accent2/10 text-accent2 border-accent2/20',
    fieldagent: 'bg-amber/10 text-amber border-amber/20',
  }

  return (
    <div className="min-h-screen bg-bg pb-16 md:pb-0">
      {/* Inactive Account Overlay */}
      {isInactive && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-card max-w-md w-full mx-4 rounded-3xl border border-border shadow-2xl p-10 text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6">
              <Ban size={40} className="text-danger" />
            </div>
            <h2 className="font-display font-bold text-2xl text-txt mb-2">Account Suspended</h2>
            <p className="text-sm text-txt2 leading-relaxed mb-6">
              Your organization&apos;s account is currently <strong className="text-danger">inactive</strong>. 
              All access has been temporarily restricted. Please contact your administrator 
              or our support team to restore access.
            </p>
            
            <div className="p-4 bg-bg3 rounded-2xl border border-border mb-6">
              <div className="flex items-center gap-3 justify-center text-txt2">
                <Mail size={16} className="text-primary" />
                <span className="text-sm font-medium">support@leadflow.in</span>
              </div>
            </div>

            <button 
              onClick={handleLogout} 
              className="btn-primary w-full py-3 justify-center text-sm shadow-lg shadow-primary/20"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-txt/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx('sidebar', sidebarOpen && 'open')}>
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-display font-extrabold text-xl text-txt tracking-tight">
              Lead<span className="text-accent">Flow</span>
            </div>
            <div className={clsx('badge mt-2 border text-xs', roleColors[role])}>
              {config.label}
            </div>
          </div>
          <button className="md:hidden text-txt2 p-1 rounded hover:bg-card2" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {config.items.map((item) => {
            const active = router.pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <div className={clsx('sidenav-item', active && 'active')}>
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div onClick={handleLogout} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-card cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
              {userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-txt truncate">
                {userName || 'User'}
              </div>
              <div className="text-xs text-txt3 truncate">{userEmail}</div>
            </div>
            <LogOut size={13} className="text-txt3 group-hover:text-danger transition-colors" />
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header className="topbar">
        <button 
          className="md:hidden p-1.5 -ml-2 text-txt2 hover:text-txt rounded-lg hover:bg-border transition-colors focus:outline-none"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={22} />
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <h1 className="font-display font-bold text-base md:text-lg text-txt truncate">{pageTitle}</h1>
        </div>

        <NotificationDropdown role={role} />

        {/* Mobile Profile Toggle */}
        <div className="relative md:hidden ml-1">
          <button 
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold border border-accent/20"
          >
            {userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
          </button>
          
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-[40]" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-[50] py-2 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-border">
                  <div className="text-sm font-bold text-txt truncate">{userName || 'User'}</div>
                  <div className="text-xs text-txt3 truncate mt-0.5">{userEmail}</div>
                </div>
                <div className="p-1.5">
                  <button 
                    onClick={handleLogout} 
                    className="w-full text-left px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <LogOut size={15} /> Log Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>

      {/* Page content */}
      <main className="page">
        <SubscriptionBanner />
        <div className="p-6 fade-up">{children}</div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 flex justify-around items-center h-16 px-1 md:hidden pb-safe">
        {config.items.slice(0, 5).map((item) => {
          const active = router.pathname === item.href
          return (
            <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center h-full text-txt3 hover:text-txt transition-colors">
              <div className={clsx('flex flex-col items-center gap-1 w-full', active && 'text-accent')}>
                <div className={clsx('p-1.5 rounded-full transition-colors', active && 'bg-accent/10')}>
                  <item.icon size={20} className={clsx(active ? 'text-accent' : 'text-txt3')} />
                </div>
                <span className="text-[10px] font-medium tracking-tight truncate w-full text-center px-1">
                  {item.label}
                </span>
              </div>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
