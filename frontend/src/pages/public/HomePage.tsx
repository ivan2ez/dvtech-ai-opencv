import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Wind,
  Brain,
  Thermometer,
  Users,
  Wrench,
  ShieldCheck,
  ClipboardCheck,
  CalendarCheck,
  UserCheck,
  CheckCircle,
  ArrowRight,
  Sparkles,
  MessageSquareText,
  Camera,
  Zap,
  MapPin,
  Phone,
  Mail,
  Facebook,
} from 'lucide-react';

import { BrandCarousel } from '@/components/home/BrandCarousel';

/** Where an authenticated user should land — customers have no dashboard. */
function landingPathForRole(role: string | undefined): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'technician':
      return '/technician';
    default:
      return '/my-requests';
  }
}

export function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const dashboardPath = landingPathForRole(user?.role);
  const dashboardLabel = user?.role === 'customer' ? 'Go to My Requests' : 'Go to Dashboard';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <HeroSection isAuthenticated={isAuthenticated} />

      {/* Brand Carousel */}
      <BrandCarousel />

      {/* Services Section */}
      <ServicesSection />

      {/* AI Feature Showcase */}
      <AIShowcaseSection />

      {/* How It Works */}
      <HowItWorksSection />



      {/* CTA Section */}
      <CTASection isAuthenticated={isAuthenticated} />

      {/* Footer */}
      <FooterSection />
    </div>
  );
}

/* ─── Hero Section ─── */
function HeroSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative overflow-hidden py-20 md:py-28 lg:py-36">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/40 to-background" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[400px] w-[400px] rounded-full bg-primary/[0.04] blur-3xl animate-[float_6s_ease-in-out_infinite]" />
        <div className="absolute -bottom-20 -left-20 h-[300px] w-[300px] rounded-full bg-primary/[0.05] blur-3xl animate-[float_8s_ease-in-out_infinite_reverse]" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm animate-[fadeInDown_0.6s_ease-out_both]">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">AI-Powered AC Solutions for DVTech</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15] animate-[fadeInUp_0.7s_ease-out_0.1s_both]">
            Smart Air Conditioning
            <br />
            <span className="text-primary">Recommendations</span> &amp; Services
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed animate-[fadeInUp_0.7s_ease-out_0.2s_both]">
            AI-driven AC sizing through image analysis and BTU calculations,
            paired with professional installation, maintenance, and repair
            from 30+ expert technicians.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 animate-[fadeInUp_0.7s_ease-out_0.35s_both]">
            {isAuthenticated ? (
              <Button size="lg" className="h-11 px-6 text-sm" asChild>
                <Link to={dashboardPath}>
                  <span className="inline-flex items-center gap-2">{dashboardLabel} <ArrowRight className="h-4 w-4" /></span>
                </Link>
              </Button>
            ) : (
              <>
                <Button size="lg" className="h-11 px-6 text-sm" asChild>
                  <Link to="/register">
                    <span className="inline-flex items-center gap-2">Get Started Free <ArrowRight className="h-4 w-4" /></span>
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-11 px-6 text-sm" asChild>
                  <Link to="/services">
                    Browse Services
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-8 text-sm text-muted-foreground animate-[fadeInUp_0.7s_ease-out_0.5s_both]">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <Users className="h-4 w-4" />
              <span>30+ Expert Technicians</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <Brain className="h-4 w-4" />
              <span>AI-Powered Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <ShieldCheck className="h-4 w-4" />
              <span>Trusted Local Provider</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Services Section ─── */
function ServicesSection() {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation();
  const { ref: cardsRef, isVisible: cardsVisible } = useScrollAnimation();

  const services = [
    {
      icon: Wind,
      title: 'Installation',
      description:
        'Professional AC installation with AI-powered sizing and optimal placement recommendations for maximum cooling efficiency.',
      features: ['Split-type, window, floor-standing', 'AI-guided placement', 'Same-week scheduling'],
    },
    {
      icon: Wrench,
      title: 'Maintenance',
      description:
        'Regular cleaning, inspection, and preventive maintenance to keep your AC running efficiently year-round.',
      features: ['Filter cleaning & replacement', 'Refrigerant check', 'Performance optimization'],
    },
    {
      icon: ClipboardCheck,
      title: 'Repair & Consultation',
      description:
        'Expert diagnosis and repair for all AC brands with AI-assisted troubleshooting for quick turnaround.',
      features: ['AI troubleshooting', 'All brands supported', 'Completion reports'],
    },
  ];

  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-4 space-y-16">
        <div
          ref={headerRef}
          className={`text-center space-y-4 transition-all duration-700 ease-out ${headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider">
            Our Services
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
            Comprehensive AC Solutions
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            From smart recommendations to professional servicing — we cover every
            aspect of your air conditioning needs.
          </p>
        </div>

        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <Card
              key={service.title}
              className={`group relative overflow-hidden hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border-border/50 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="pb-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <service.icon className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-xl">{service.title}</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  {service.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {service.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
                <Separator className="my-4" />
                <Link
                  to="/services"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline gap-1.5 group/link"
                >
                  View service details
                  <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── AI Feature Showcase ─── */
function AIShowcaseSection() {
  const { ref: leftRef, isVisible: leftVisible } = useScrollAnimation();
  const { ref: rightRef, isVisible: rightVisible } = useScrollAnimation();

  return (
    <section className="py-24 md:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/[0.03] to-transparent" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div
            ref={leftRef}
            className={`space-y-8 transition-all duration-700 ease-out ${leftVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}
          >
            <div className="space-y-4">
              <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider">
                AI Technology
              </Badge>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                Intelligent Room Analysis
                <br />
                <span className="text-primary">Powered by AI</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Our system uses advanced AI image analysis and smart BTU calculations
                to recommend the perfect air conditioning unit for your space.
              </p>
            </div>

            <div className="space-y-5">
              <AIFeatureItem
                icon={Camera}
                title="Room Image Analysis"
                description="Upload a photo and our AI analyzes room size, windows, sunlight exposure, and heat sources."
              />
              <AIFeatureItem
                icon={Thermometer}
                title="Precise BTU Calculation"
                description="Factors in area, ceiling height, occupancy, and environmental conditions for accurate sizing."
              />
              <AIFeatureItem
                icon={Zap}
                title="Instant Product Matching"
                description="Automatically matches your requirements to the best AC products in our catalog."
              />
              <AIFeatureItem
                icon={MessageSquareText}
                title="AI Chatbot Guidance"
                description="Our conversational assistant guides you through the process and answers questions instantly."
              />
            </div>
          </div>

          {/* Right: Visual representation */}
          <div
            ref={rightRef}
            className={`relative transition-all duration-700 ease-out delay-200 ${rightVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}
          >
            <div className="relative bg-gradient-to-br from-card to-card/80 border rounded-2xl p-8 shadow-2xl shadow-primary/5">
              {/* Mock AI interface */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">DVTech AI Analyzer</p>
                    <p className="text-xs text-muted-foreground">Processing room data...</p>
                  </div>
                  <div className="ml-auto">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                </div>

                <Separator />

                {/* Room data mock */}
                <div className="grid grid-cols-2 gap-4">
                  <DataBlock label="Room Area" value="24 sqm" />
                  <DataBlock label="Ceiling Height" value="2.8m" />
                  <DataBlock label="Occupancy" value="4 persons" />
                  <DataBlock label="Sunlight" value="High" />
                </div>

                <Separator />

                {/* Result mock */}
                <div className="bg-primary/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">AI Recommendation Ready</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Required BTU</p>
                      <p className="text-lg font-bold text-primary">24,000</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Recommended HP</p>
                      <p className="text-lg font-bold text-primary">2.5 HP</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="secondary" className="text-xs">Split-Type</Badge>
                    <Badge variant="secondary" className="text-xs">Inverter</Badge>
                  </div>
                </div>
              </div>

              {/* Decorative glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl blur-xl -z-10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─── */
function HowItWorksSection() {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation();
  const { ref: stepsRef, isVisible: stepsVisible } = useScrollAnimation();

  const steps = [
    {
      step: 1,
      icon: UserCheck,
      title: 'Create an Account',
      description: 'Register for free to access AI-powered recommendations and service booking.',
    },
    {
      step: 2,
      icon: Camera,
      title: 'Get AI Recommendation',
      description: 'Input room details or upload a photo for personalized AC sizing.',
    },
    {
      step: 3,
      icon: ClipboardCheck,
      title: 'Submit a Request',
      description: 'Choose your service and submit. Admin reviews and approves promptly.',
    },
    {
      step: 4,
      icon: CalendarCheck,
      title: 'Technician Assigned',
      description: 'A qualified technician is scheduled to complete the service.',
    },
  ];

  return (
    <section className="py-24 md:py-32 bg-background relative">
      <div className="container mx-auto px-4 space-y-16">
        <div
          ref={headerRef}
          className={`text-center space-y-4 transition-all duration-700 ease-out ${headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider">
            How It Works
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
            Four Simple Steps
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            From sign-up to service completion — our streamlined process makes
            getting the right AC solution effortless.
          </p>
        </div>

        <div ref={stepsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {steps.map((item, index) => (
            <div
              key={item.step}
              className={`relative group transition-all duration-700 ease-out ${stepsVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Connector line (hidden on last item and on mobile) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] right-[calc(-50%+2rem)] h-px bg-border" />
              )}
              <div className="flex flex-col items-center text-center space-y-4 relative">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 group-hover:shadow-primary/40 group-hover:scale-105 transition-all duration-300">
                    <item.icon className="h-7 w-7" />
                  </div>
                  <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-primary text-xs font-bold text-primary">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Section ─── */
function CTASection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/90" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 h-64 w-64 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-primary-foreground/5 blur-3xl" />
      </div>

      <div
        ref={ref}
        className={`container relative mx-auto px-4 text-center space-y-8 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        <div className="space-y-4 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground">
            Ready to Experience
            <br />
            Smart AC Service?
          </h2>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Create a free account to access AI recommendations, submit service
            requests, and connect with our expert technicians.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          {isAuthenticated ? (
            <Button size="lg" variant="secondary" asChild>
              <Link to={dashboardPath}>
                <span className="inline-flex items-center gap-2">{dashboardLabel} <ArrowRight className="h-4 w-4" /></span>
              </Link>
            </Button>
          ) : (
            <>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/register">
                  <span className="inline-flex items-center gap-2">Create Free Account <ArrowRight className="h-4 w-4" /></span>
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                asChild
              >
                <Link to="/login">Sign In</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer Section ─── */
function FooterSection() {
  return (
    <footer className="py-16 border-t bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-1 space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center">
                <Wind className="h-4 w-4 text-brand-foreground" />
              </div>
              <span className="font-bold text-xl">DVTech</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI-Powered Air Conditioning Recommendation, Service Request Management,
              and Technician Scheduling System.
            </p>
          </div>

          {/* Services Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Services</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Installation
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Maintenance
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Repair & Consultation
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  AC Products
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Quick Links</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Get Started
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Browse Services
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  View Products
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Contact</h4>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                <span>0236 McArthur Highway, Biñang 2nd, Bocaue, Bulacan, Philippines, 3018</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <a href="tel:+639178389186" className="hover:text-foreground transition-colors">
                  0917 838 9186
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <a
                  href="mailto:dvtechengineering.co@gmail.com"
                  className="hover:text-foreground transition-colors break-all"
                >
                  dvtechengineering.co@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Facebook className="h-4 w-4 shrink-0 mt-0.5" />
                <a
                  href="https://www.facebook.com/DVTechSuppliesandServicesIncorporated"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  DVTech Supplies and Services Incorporated
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} DVTech. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            AI-Powered Web-Based System
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Reusable Sub-Components ─── */

function AIFeatureItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 items-start">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="space-y-1">
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function DataBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}


