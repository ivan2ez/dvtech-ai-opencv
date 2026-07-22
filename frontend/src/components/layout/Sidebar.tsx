import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Box,
  Thermometer,
  Users,
  BarChart3,
  ClipboardList,
  PanelLeft,
} from 'lucide-react';
import type { UserRole } from '@/types';

interface SidebarLink {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getAdminLinks(): SidebarLink[] {
  return [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
    { label: 'Manage Requests', to: '/admin/requests', icon: FileText },
    { label: 'Manage Schedules', to: '/admin/schedules', icon: CalendarDays },
    { label: 'Manage Products', to: '/admin/products', icon: Box },
    { label: 'BTU Factors', to: '/admin/btu-factors', icon: Thermometer },
    { label: 'Manage Accounts', to: '/admin/accounts', icon: Users },
    { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
  ];
}

function getTechnicianLinks(): SidebarLink[] {
  return [
    { label: 'Dashboard', to: '/technician', icon: LayoutDashboard },
    { label: 'My Tasks', to: '/technician/tasks', icon: ClipboardList },
  ];
}

function getSidebarLinks(role: UserRole | null): SidebarLink[] {
  switch (role) {
    case 'admin':
      return getAdminLinks();
    case 'technician':
      return getTechnicianLinks();
    default:
      return [];
  }
}

function isLinkActive(linkTo: string, pathname: string): boolean {
  // Exact match for dashboard roots, prefix match for sub-pages
  if (linkTo === '/admin' || linkTo === '/technician') {
    return pathname === linkTo;
  }
  return pathname.startsWith(linkTo);
}

interface SidebarNavProps {
  links: SidebarLink[];
  pathname: string;
  onLinkClick?: () => void;
}

function SidebarNav({ links, pathname, onLinkClick }: SidebarNavProps) {
  return (
    <nav className="flex flex-col gap-1 px-2 py-4">
      {links.map((link) => {
        const active = isLinkActive(link.to, pathname);
        const Icon = link.icon;
        return (
          <Link
            key={link.to}
            to={link.to}
            onClick={onLinkClick}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = getSidebarLinks(user?.role ?? null);

  if (links.length === 0) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r bg-background">
        <div className="flex h-14 items-center px-4 border-b">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {user?.role === 'admin' ? 'Admin Panel' : 'Technician Panel'}
          </span>
        </div>
        <SidebarNav links={links} pathname={location.pathname} />
      </aside>

      {/* Mobile sidebar trigger + sheet */}
      <div className="md:hidden fixed bottom-4 left-4 z-40">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full shadow-lg"
              aria-label="Open sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-14 items-center px-4 border-b">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {user?.role === 'admin' ? 'Admin Panel' : 'Technician Panel'}
              </span>
            </div>
            <Separator />
            <SidebarNav
              links={links}
              pathname={location.pathname}
              onLinkClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
