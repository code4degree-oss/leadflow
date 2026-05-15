# DYLeadFlow CRM — Frontend

Complete Next.js + React frontend for the DYLeadFlow Real Estate CRM SaaS.

## Tech Stack
- **Next.js 14** (Pages Router)
- **React 18**
- **Tailwind CSS 3**
- **Recharts** — charts and analytics
- **Lucide React** — icons
- **DM Sans + Syne + DM Mono** — Google Fonts

## Setup & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Pages & Routes

| Route | Screen | Role |
|-------|--------|------|
| `/` | Login page | All |
| `/superadmin` | Platform overview dashboard | Super Admin |
| `/superadmin/clients` | Client accounts management | Super Admin |
| `/admin` | Admin dashboard (leads, performance, alerts) | Client Admin |
| `/admin/upload` | CSV lead upload + duplicate review | Client Admin |
| `/admin/employees` | Employee management | Client Admin |
| `/admin/audit` | Immutable audit trail | Client Admin |
| `/telecaller` | My leads dashboard + status panel | Telecaller |
| `/fieldagent` | Site visit dashboard + outcome form | Field Agent |

## Design System

Dark enterprise theme with sharp accents. All colors via CSS variables in `styles/globals.css`.

| Variable | Color | Use |
|----------|-------|-----|
| `--accent` | #4F8EF7 | Primary actions, admin |
| `--accent2` | #00D4AA | Success, telecaller |
| `--amber` | #F5A623 | Warnings, field agent |
| `--danger` | #FF5A5A | Errors, deletions |
| `--hot` | #FF6B35 | Hot lead flag |
| `--purple` | #8B6CF7 | Super admin, plans |

## Component Library (`components/UI.js`)

- `StatCard` — metric card with trend indicator
- `MiniAreaChart` / `MiniBarChart` / `DonutChart` — Recharts wrappers
- `ProgressBar` — colored progress bar
- `StatusBadge` — lead/employee status pill
- `LeadRow` — table row with actions
- `SectionHeader` — page section header
- `EmptyState` — empty content placeholder

## API Integration

Replace mock data in each page with TanStack Query hooks calling the Django DRF backend at `/api/v1/`.

```bash
npm install @tanstack/react-query axios
```

Example:
```js
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const { data: leads } = useQuery({
  queryKey: ['leads'],
  queryFn: () => axios.get('/api/v1/leads/').then(r => r.data)
})
```

## Mobile Responsive

All pages use Tailwind responsive classes. Works on mobile with:
- Responsive grid layouts
- Horizontal scrollable tables on small screens
- Bottom nav pattern (add for mobile-specific layout)
