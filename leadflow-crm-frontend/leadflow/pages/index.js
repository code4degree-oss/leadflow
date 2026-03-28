import { useEffect, useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import {
  ArrowRight, BarChart2, Shield, MapPin, Users, Zap, Phone,
  ChevronRight, Star, TrendingUp, Globe, Lock, Menu, X
} from 'lucide-react'

/* ─── Floating Orb Component ─── */
function FloatingOrb({ className, style }) {
  return <div className={`absolute rounded-full blur-3xl pointer-events-none ${className}`} style={style} />
}

/* ─── Animated Counter ─── */
function AnimatedStat({ value, suffix = '', label }) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true) },
      { threshold: 0.3 }
    )
    const el = document.getElementById(`stat-${label.replace(/\s/g, '')}`)
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [label])

  useEffect(() => {
    if (!started) return
    let start = 0
    const end = parseInt(value)
    const duration = 2000
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [value, started])

  return (
    <div className="text-center" id={`stat-${label.replace(/\s/g, '')}`}>
      <div className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl bg-gradient-to-r from-[#250099] to-[#ef0379] bg-clip-text text-transparent">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">{label}</div>
    </div>
  )
}

/* ─── Feature Card ─── */
function FeatureCard({ icon: Icon, title, description, accent = false }) {
  return (
    <div className={`group relative p-5 sm:p-6 rounded-2xl border transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${
      accent
        ? 'bg-gradient-to-br from-[#250099]/[0.03] to-[#ef0379]/[0.05] border-[#ef0379]/15 hover:border-[#ef0379]/30 hover:shadow-[#ef0379]/10'
        : 'bg-white border-slate-200/80 hover:border-[#250099]/25 hover:shadow-[#250099]/10'
    }`}>
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 ${
        accent
          ? 'bg-[#ef0379]/10 text-[#ef0379] group-hover:bg-[#ef0379]/15'
          : 'bg-[#250099]/10 text-[#250099] group-hover:bg-[#250099]/15'
      }`}>
        <Icon size={20} />
      </div>
      <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 mb-2">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  )
}

/* ─── Main Landing Page ─── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <Head>
        <title>LeadFlow — Enterprise Real Estate CRM</title>
        <meta name="description" content="LeadFlow is the enterprise-grade CRM platform for real estate teams. Manage leads, track performance, and close deals faster with intelligent automation." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-[#FAFBFF] text-slate-900 overflow-x-hidden">

        {/* ─── ANIMATED BACKGROUND ─── */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.12]" style={{
            backgroundImage: 'linear-gradient(rgba(37,0,153,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(37,0,153,0.4) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
          <FloatingOrb
            className="w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] top-[-15%] left-[-10%] animate-float-slow"
            style={{ background: 'radial-gradient(circle, rgba(37,0,153,0.08) 0%, transparent 70%)' }}
          />
          <FloatingOrb
            className="w-[350px] h-[350px] sm:w-[500px] sm:h-[500px] top-[15%] right-[-8%] animate-float-medium"
            style={{ background: 'radial-gradient(circle, rgba(239,3,121,0.06) 0%, transparent 70%)' }}
          />
          <FloatingOrb
            className="w-[300px] h-[300px] sm:w-[450px] sm:h-[450px] bottom-[5%] left-[15%] animate-float-reverse"
            style={{ background: 'radial-gradient(circle, rgba(37,0,153,0.06) 0%, transparent 70%)' }}
          />
          <FloatingOrb
            className="w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] bottom-[35%] right-[25%] animate-float-slow"
            style={{ background: 'radial-gradient(circle, rgba(239,3,121,0.05) 0%, transparent 70%)' }}
          />
        </div>

        {/* ─── NAVBAR ─── */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#F0EEFF]/90 backdrop-blur-xl border-b border-[#250099]/10 shadow-sm shadow-[#250099]/5'
            : 'bg-[#F0EEFF]/60 backdrop-blur-sm'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
            <div className="relative">
              <div className="absolute -inset-3 rounded-xl bg-gradient-to-r from-[#250099]/20 to-[#ef0379]/20 blur-xl pointer-events-none" />
              <div className="relative font-display font-extrabold text-lg sm:text-xl tracking-tight text-slate-900">
                Lead<span className="text-[#250099]">Flow</span>
              </div>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8 text-sm text-slate-500">
              <a href="#features" className="hover:text-[#250099] transition-colors">Features</a>
              <a href="#stats" className="hover:text-[#250099] transition-colors">Why Us</a>
              <a href="#security" className="hover:text-[#250099] transition-colors">Security</a>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login">
                <button className="hidden sm:inline-flex px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 bg-gradient-to-r from-[#250099] to-[#ef0379] text-white hover:opacity-90 hover:shadow-lg hover:shadow-[#ef0379]/20 active:scale-95">
                  Login
                </button>
              </Link>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 py-4 space-y-1 animate-fade-in">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-[#250099]">Features</a>
              <a href="#stats" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-[#250099]">Why Us</a>
              <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-[#250099]">Security</a>
              <Link href="/login">
                <span className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#250099] to-[#ef0379] text-center mt-2">Login</span>
              </Link>
            </div>
          )}
        </nav>

        {/* ─── HERO SECTION ─── */}
        <section className="relative z-10 pt-24 pb-12 sm:pt-32 sm:pb-20 md:pt-40 md:pb-28 lg:pt-44 lg:pb-32 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-[#250099]/[0.05] border border-[#250099]/10 text-[10px] sm:text-xs text-[#250099] font-medium mb-6 sm:mb-8 animate-fade-in">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ef0379] animate-pulse" />
              Enterprise-Grade CRM for Real Estate
            </div>

            {/* Main Heading */}
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-7xl leading-[1.1] tracking-tight mb-4 sm:mb-6 animate-fade-up text-slate-900">
              Capture. Convert. <br />
              <span className="bg-gradient-to-r from-[#250099] via-[#ef0379] to-[#250099] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift">
                Close Every Deal.
              </span>
            </h1>

            {/* Subheading */}
            <p className="max-w-xs sm:max-w-lg md:max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-slate-500 leading-relaxed mb-8 sm:mb-10 animate-fade-up-delayed">
              LeadFlow empowers real estate organizations to manage leads with intelligent 
              assignment, geofenced tracking, role-based dashboards, and real-time analytics 
              — all in one platform.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-up-delayed-2">
              <Link href="/login">
                <button className="group w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm font-bold transition-all duration-300 bg-gradient-to-r from-[#250099] to-[#ef0379] text-white hover:shadow-xl hover:shadow-[#ef0379]/25 active:scale-95 flex items-center justify-center gap-2">
                  Get Started
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <a href="#features">
                <button className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl text-sm font-medium transition-all duration-300 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm flex items-center justify-center gap-2">
                  Explore Features
                  <ChevronRight size={14} />
                </button>
              </a>
            </div>

          </div>
        </section>

        {/* ─── STATS BAR ─── */}
        <section id="stats" className="relative z-10 py-12 sm:py-16 border-y border-slate-200/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <AnimatedStat value="50000" suffix="+" label="Leads Managed" />
            <AnimatedStat value="500" suffix="+" label="Real Estate Teams" />
            <AnimatedStat value="99" suffix=".9%" label="Uptime SLA" />
            <AnimatedStat value="24" suffix="/7" label="Platform Support" />
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#250099]/[0.06] text-[10px] sm:text-xs text-[#250099] font-semibold mb-4 border border-[#250099]/10">
                <Zap size={12} /> POWERFUL FEATURES
              </div>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3 sm:mb-4 text-slate-900">
                Everything You Need to <span className="text-[#ef0379]">Dominate</span> Real Estate
              </h2>
              <p className="max-w-xl mx-auto text-xs sm:text-sm text-slate-500">
                From lead capture to deal closure, LeadFlow provides every tool your team 
                needs to scale operations efficiently.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              <FeatureCard
                icon={Users}
                title="Intelligent Lead Assignment"
                description="Automatically route leads to the right agent based on location, availability, and performance history."
              />
              <FeatureCard
                icon={MapPin}
                title="Geofenced Tracking"
                description="GPS-verified site visits with geofence boundaries. Know exactly when and where your field agents are active."
                accent
              />
              <FeatureCard
                icon={BarChart2}
                title="Real-Time Analytics"
                description="Live dashboards with conversion funnels, team performance heatmaps, and predictive lead scoring."
              />
              <FeatureCard
                icon={Phone}
                title="Telecaller Management"
                description="Track call logs, set reminders, and monitor follow-up cadence for your entire telecalling team."
                accent
              />
              <FeatureCard
                icon={Shield}
                title="Role-Based Access"
                description="Granular permissions for Super Admins, Client Admins, Managers, Telecallers, and Field Agents."
              />
              <FeatureCard
                icon={TrendingUp}
                title="Performance Insights"
                description="Individual and team-level KPIs with automated reports and export capabilities."
                accent
              />
            </div>
          </div>
        </section>

        {/* ─── SECURITY SECTION ─── */}
        <section id="security" className="relative z-10 py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/60 bg-gradient-to-br from-[#250099]/[0.02] via-white to-[#ef0379]/[0.03] p-6 sm:p-10 md:p-16 shadow-lg shadow-[#250099]/[0.03]">
              <div className="grid md:grid-cols-2 gap-8 sm:gap-10 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ef0379]/[0.08] text-[10px] sm:text-xs text-[#ef0379] font-semibold mb-4 border border-[#ef0379]/15">
                    <Lock size={12} /> ENTERPRISE SECURITY
                  </div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3 sm:mb-4 text-slate-900">
                    Built for <span className="text-[#250099]">Enterprise</span> Security
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-5 sm:mb-6">
                    LeadFlow is designed with enterprise-grade security at its core. 
                    From JWT-secured authentication to geo-locked logins, every layer 
                    is built to protect your business data.
                  </p>
                  <Link href="/login">
                    <button className="group px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all duration-300 bg-gradient-to-r from-[#250099] to-[#ef0379] text-white hover:shadow-xl hover:shadow-[#ef0379]/25 active:scale-95 flex items-center gap-2">
                      Book Demo
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </Link>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {[
                    { icon: Lock, text: 'JWT Token Authentication', sub: 'Stateless, secure session management' },
                    { icon: MapPin, text: 'Geofenced Login Enforcement', sub: 'Only allow login from approved locations' },
                    { icon: Shield, text: 'Role-Based Access Control', sub: '5-tier permission hierarchy' },
                    { icon: Globe, text: 'Audit Trail Logging', sub: 'Every action tracked and timestamped' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white border border-slate-200/60 hover:border-[#250099]/20 hover:shadow-md transition-all duration-300">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#250099]/[0.08] flex items-center justify-center text-[#250099] shrink-0">
                        <item.icon size={16} />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-800">{item.text}</div>
                        <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA SECTION ─── */}
        <section className="relative z-10 py-16 sm:py-20 md:py-28 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl md:text-5xl tracking-tight mb-4 sm:mb-5 text-slate-900">
              Ready to Transform Your <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-[#250099] to-[#ef0379] bg-clip-text text-transparent">
                Real Estate Business?
              </span>
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-slate-500 mb-6 sm:mb-8 max-w-lg mx-auto">
              Join hundreds of real estate organizations that trust LeadFlow to 
              manage their leads, teams, and performance.
            </p>
            <Link href="/login">
              <button className="group px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm font-bold transition-all duration-300 bg-gradient-to-r from-[#250099] to-[#ef0379] text-white hover:shadow-2xl hover:shadow-[#ef0379]/30 active:scale-95 flex items-center gap-2 mx-auto">
                Book Demo
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="relative z-10 py-6 sm:py-8 px-4 sm:px-6 bg-[#F0EEFF]/80 border-t border-[#250099]/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="font-display font-extrabold text-lg tracking-tight text-slate-900">
              Lead<span className="text-[#250099]">Flow</span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 text-center sm:text-right">
              © 2026 DY Business Solutions Pvt. Ltd. – All Rights Reserved.
            </p>
          </div>
        </footer>

      </div>

      {/* ─── INLINE KEYFRAME STYLES FOR ANIMATIONS ─── */}
      <style jsx global>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, 30px) scale(1.08); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(25px, 35px) scale(1.03); }
          80% { transform: translate(-15px, -25px) scale(0.97); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-float-slow { animation: float-slow 20s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 15s ease-in-out infinite; }
        .animate-float-reverse { animation: float-reverse 18s ease-in-out infinite; }
        .animate-gradient-shift { animation: gradient-shift 4s ease infinite; }
        .animate-fade-in { animation: fade-in 0.8s ease forwards; }
        .animate-fade-up { animation: fade-up 0.8s ease forwards; }
        .animate-fade-up-delayed { animation: fade-up 0.8s ease 0.2s forwards; opacity: 0; }
        .animate-fade-up-delayed-2 { animation: fade-up 0.8s ease 0.4s forwards; opacity: 0; }

        /* Smooth scrolling */
        html { scroll-behavior: smooth; }
      `}</style>
    </>
  )
}
