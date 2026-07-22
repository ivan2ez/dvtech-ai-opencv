import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 py-20 md:py-32">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            AI-Powered Air Conditioning Solutions
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            DVTech delivers smart, data-driven AC recommendations and professional
            installation, maintenance, and repair services — all powered by AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            {isAuthenticated ? (
              <Button size="lg" asChild>
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button size="lg" asChild>
                  <Link to="/register">Get Started</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/services">View Services</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Service Overview Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-4xl font-bold">Our Services</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Comprehensive air conditioning services for homes and businesses
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <InstallIcon />
                </div>
                <CardTitle>Installation</CardTitle>
                <CardDescription>
                  Professional AC installation with proper sizing and placement
                  recommendations powered by AI analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  to="/services"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Learn more →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <MaintenanceIcon />
                </div>
                <CardTitle>Maintenance</CardTitle>
                <CardDescription>
                  Regular cleaning, inspection, and preventive maintenance to keep
                  your AC running efficiently year-round.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  to="/services"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Learn more →
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <RepairIcon />
                </div>
                <CardTitle>Repair & Consultation</CardTitle>
                <CardDescription>
                  Expert diagnosis and repair for all AC brands. Get AI-assisted
                  troubleshooting and quick turnaround from our technicians.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  to="/services"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Learn more →
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-4xl font-bold">Why DVTech?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We combine AI technology with professional expertise to give you the
              best AC experience
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <AiIcon />
                </div>
                <CardTitle className="text-lg">AI-Powered Recommendations</CardTitle>
                <CardDescription>
                  Upload a photo of your room and receive intelligent AC sizing
                  recommendations based on real-time analysis.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <BtuIcon />
                </div>
                <CardTitle className="text-lg">Smart BTU Calculation</CardTitle>
                <CardDescription>
                  Accurate BTU estimation using room dimensions, occupancy, and
                  environmental factors — ensuring the perfect unit for your space.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <TechnicianIcon />
                </div>
                <CardTitle className="text-lg">Expert Technician Network</CardTitle>
                <CardDescription>
                  A team of 30+ skilled technicians ready to handle installation,
                  maintenance, and repairs with transparent scheduling.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Get Started?
          </h2>
          <p className="text-primary-foreground/80 max-w-lg mx-auto">
            Create an account today to access AI recommendations, submit service
            requests, and connect with our expert technicians.
          </p>
          {isAuthenticated ? (
            <Button size="lg" variant="secondary" asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <Button size="lg" variant="secondary" asChild>
              <Link to="/register">Create Free Account</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-background">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} DVTech. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

/* Icon components using inline SVGs for simplicity */

function InstallIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M12 2v20" />
      <path d="m19 15-7 7-7-7" />
      <rect x="4" y="2" width="16" height="6" rx="1" />
    </svg>
  );
}

function MaintenanceIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function RepairIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92" />
      <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.92" />
      <path d="M12 9v13" />
      <path d="M7 17l5-4 5 4" />
      <path d="M4 21h16" />
    </svg>
  );
}

function BtuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
    </svg>
  );
}

function TechnicianIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
