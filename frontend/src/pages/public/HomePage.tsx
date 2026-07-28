import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
  MonitorSmartphone,
  MessageSquareText,
  Camera,
  Zap,
  Clock,
  Star,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';

export function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <HeroSection isAuthenticated={isAuthenticated} />

      {/* Services Section */}
      <ServicesSection />

      {/* AI Feature Showcase */}
      <AIShowcaseSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Stats Section */}
      <StatsSection />

      {/* Features Grid */}
      <FeaturesSection />

      {/* Roles Overview */}
      <RolesSection />

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
        <div className="absolute -top-40 -right-40 h-[400px] w-[400px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-[300px] w-[300px] rounded-full bg-primary/[0.05] blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">AI-Powered AC Solutions for DVTech</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15]">
            Smart Air Conditioning
            <br />
            <span className="text-primary">Recommendations</span> &amp; Services
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
            AI-driven AC sizing through image analysis and BTU calculations,
            paired with professional installation, maintenance, and repair
            from 30+ expert technicians.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6">
            {isAuthenticated ? (
              <Button size="lg" className="h-11 px-6 text-sm" asChild>
                <Link to="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button size="lg" className="h-11 px-6 text-sm" asChild>
                  <Link to="/register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
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
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-8 text-sm text-muted-foreground">
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
        <div className="text-center space-y-4">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service) => (
            <Card
              key={service.title}
              className="group relative overflow-hidden hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border-border/50"
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
  return (
    <section className="py-24 md:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/[0.03] to-transparent" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div className="space-y-8">
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
          <div className="relative">
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
        <div className="text-center space-y-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {steps.map((item, index) => (
            <div key={item.step} className="relative group">
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

/* ─── Stats Section ─── */
function StatsSection() {
  const stats = [
    { value: '30+', label: 'Expert Technicians', icon: Users },
    { value: '3', label: 'Service Categories', icon: Wind },
    { value: 'AI', label: 'Powered Recommendations', icon: Brain },
    { value: '24/7', label: 'Chatbot Support', icon: Clock },
  ];

  return (
    <section className="py-20 bg-primary relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-xl bg-primary-foreground/10 flex items-center justify-center">
                  <stat.icon className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <p className="text-3xl md:text-4xl font-bold text-primary-foreground">{stat.value}</p>
              <p className="text-sm text-primary-foreground/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features Section ─── */
function FeaturesSection() {
  const features = [
    {
      icon: Brain,
      title: 'AI Image Analysis',
      description: 'Upload a room photo for intelligent AC sizing based on real-time AI analysis.',
    },
    {
      icon: Thermometer,
      title: 'Smart BTU Calculation',
      description: 'Accurate estimation using dimensions, occupancy, and environmental factors.',
    },
    {
      icon: Users,
      title: 'Expert Technicians',
      description: '30+ skilled technicians for installation, maintenance, and repairs.',
    },
    {
      icon: MonitorSmartphone,
      title: 'Track Online',
      description: 'Monitor service requests in real-time from any device.',
    },
    {
      icon: MessageSquareText,
      title: 'AI Chatbot',
      description: 'Guided support to collect room details and answer your questions.',
    },
    {
      icon: ShieldCheck,
      title: 'Secure & Reliable',
      description: 'Protected with secure authentication and role-based access control.',
    },
  ];

  return (
    <section className="py-24 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 space-y-16">
        <div className="text-center space-y-4">
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider">
            Why DVTech
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
            Powered by AI, Backed by Experts
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Cutting-edge AI technology combined with professional expertise for the
            best air conditioning experience.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative p-6 rounded-2xl bg-background border hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Roles Section ─── */
function RolesSection() {
  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-4 space-y-16">
        <div className="text-center space-y-4">
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider">
            For Everyone
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
            Built for Every Role
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Whether you're a customer, admin, or technician — DVTech provides a
            tailored experience for your needs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <RoleCard
            icon={UserCheck}
            title="Customers"
            description="Access smart recommendations and book services"
            features={[
              'Browse services and products',
              'Get AI-powered AC recommendations',
              'Submit and track service requests',
              'Chat with AI assistant',
            ]}
            gradient="from-blue-500/10 to-blue-500/5"
          />
          <RoleCard
            icon={CalendarCheck}
            title="Admin"
            description="Manage operations and oversee the business"
            features={[
              'Approve and manage requests',
              'Assign technicians to tasks',
              'Manage products and pricing',
              'Generate performance reports',
            ]}
            gradient="from-purple-500/10 to-purple-500/5"
          />
          <RoleCard
            icon={Wrench}
            title="Technicians"
            description="Handle tasks and track your schedule"
            features={[
              'View assigned tasks and schedules',
              'Accept or reject assignments',
              'Update task progress in real-time',
              'Submit completion reports',
            ]}
            gradient="from-green-500/10 to-green-500/5"
          />
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Section ─── */
function CTASection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/90" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 h-64 w-64 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-primary-foreground/5 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 text-center space-y-8">
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
              <Link to="/dashboard">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/register">
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                asChild
              >
                <Link to="/login">Sign In</Link>
              </Button>
            </>
          )}
        </div>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-1 pt-6">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          ))}
          <span className="ml-2 text-sm text-primary-foreground/70">
            Trusted by customers across the community
          </span>
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
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Wind className="h-4 w-4 text-primary-foreground" />
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
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>Local AC Service Provider</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>Contact us via the platform</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span>support@dvtech.com</span>
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

function RoleCard({
  icon: Icon,
  title,
  description,
  features,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  features: string[];
  gradient: string;
}) {
  return (
    <Card className="group relative overflow-hidden hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
      {/* Gradient overlay on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <CardHeader className="relative">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-2.5">
            <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
