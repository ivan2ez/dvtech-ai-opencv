import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import type { UserRole } from '@/types';

interface NavLink {
  label: string;
  to: string;
}

function getNavLinks(role: UserRole | null): NavLink[] {
  if (!role) {
    // Guest (unauthenticated)
    return [
      { label: 'Home', to: '/' },
      { label: 'Services', to: '/services' },
      { label: 'Products', to: '/products' },
    ];
  }

  switch (role) {
    case 'customer':
      return [
        { label: 'Home', to: '/' },
        { label: 'Services', to: '/services' },
        { label: 'Products', to: '/products' },
        { label: 'Dashboard', to: '/dashboard' },
      ];
    case 'admin':
      return [
        { label: 'Home', to: '/' },
        { label: 'Services', to: '/services' },
        { label: 'Products', to: '/products' },
        { label: 'Dashboard', to: '/admin' },
      ];
    case 'technician':
      return [
        { label: 'Home', to: '/' },
        { label: 'Services', to: '/services' },
        { label: 'Products', to: '/products' },
        { label: 'Dashboard', to: '/technician' },
      ];
    default:
      return [
        { label: 'Home', to: '/' },
        { label: 'Services', to: '/services' },
        { label: 'Products', to: '/products' },
      ];
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = getNavLinks(isAuthenticated ? user?.role ?? null : null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  function isActive(linkTo: string): boolean {
    if (linkTo === '/') return location.pathname === '/';
    return location.pathname === linkTo || location.pathname.startsWith(linkTo + '/');
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo / Brand */}
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-primary">DVTech</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "px-3 py-2 text-sm font-medium transition-colors rounded-md",
                isActive(link.to)
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side: Auth buttons or User menu */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated && user ? (
            <UserMenu user={user} onLogout={handleLogout} />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <HamburgerIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="text-left">
                <span className="text-primary font-bold">DVTech</span>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors rounded-md",
                    isActive(link.to)
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Separator className="my-4" />
            {isAuthenticated && user ? (
              <div className="flex flex-col gap-2 px-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
                <Separator className="my-2" />
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                >
                  Profile
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start text-destructive hover:text-destructive"
                  onClick={() => {
                    handleLogout();
                    setMobileOpen(false);
                  }}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 px-3">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login" onClick={() => setMobileOpen(false)}>
                    Login
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register" onClick={() => setMobileOpen(false)}>
                    Register
                  </Link>
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

interface UserMenuProps {
  user: { name: string; email: string };
  onLogout: () => void;
}

function UserMenu({ user, onLogout }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link to="/profile">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            onClick={onLogout}
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HamburgerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}
