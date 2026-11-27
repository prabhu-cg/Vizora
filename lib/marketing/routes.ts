export interface MarketingRoute {
  path: string;
  label: string;
  /** Used in the sitemap. */
  priority: number;
}

/** Every public marketing page. Navigation, footer, sitemap and tests all read this. */
export const MARKETING_ROUTES = {
  home: { path: "/", label: "Home", priority: 1 },
  features: { path: "/features", label: "Features", priority: 0.9 },
  howItWorks: { path: "/how-it-works", label: "How it works", priority: 0.8 },
  useCases: { path: "/use-cases", label: "Use cases", priority: 0.8 },
  pricing: { path: "/pricing", label: "Pricing", priority: 0.9 },
  about: { path: "/about", label: "About", priority: 0.5 },
  faq: { path: "/faq", label: "FAQ", priority: 0.7 },
  privacy: { path: "/privacy", label: "Privacy policy", priority: 0.3 },
  terms: { path: "/terms", label: "Terms of service", priority: 0.3 },
} as const satisfies Record<string, MarketingRoute>;

/** The working Free application. All "Start free" calls to action point here. */
export const APP_HREF = "/app/dashboard";

export const NAV = {
  product: { label: "Product", items: [MARKETING_ROUTES.home, MARKETING_ROUTES.howItWorks] },
  primary: [MARKETING_ROUTES.features, MARKETING_ROUTES.useCases, MARKETING_ROUTES.pricing],
  resources: { label: "Resources", items: [MARKETING_ROUTES.faq, MARKETING_ROUTES.about, MARKETING_ROUTES.privacy, MARKETING_ROUTES.terms] },
} as const;
