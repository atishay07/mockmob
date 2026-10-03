export const siteConfig = {
  name: 'MockMob',
  legalName: 'MockMob',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://mockmob.in',
  description:
    'MockMob helps CUET aspirants practise free mock tests, previous year questions, online practice tests, analytics, and DU admission planning.',
  email: 'support@mockmob.in',
  socialLinks: [],
};

export const publicRoutes = [
  {
    path: '/',
    title: 'CUET Mock Tests & Practice Questions | MockMob',
    description:
      'Take CUET mock tests, review practice mistakes, track weak chapters, and prepare for CUET UG with MockMob.',
    priority: 1,
  },
  {
    path: '/features',
    title: 'CUET Practice Features, Analytics & Admission Compass | MockMob',
    description:
      'Explore MockMob features for CUET mock tests, weakness radar, saved questions, leaderboards, and admission guidance.',
    priority: 0.8,
  },
  {
    path: '/pricing',
    title: 'MockMob Pricing for CUET Mock Tests & Analytics',
    description:
      'Start free or unlock MockMob Pro for unlimited CUET mocks, advanced Radar analytics, bookmarks, and Admission Compass.',
    priority: 0.7,
  },
  {
    path: '/cuet-cutoff-calculator',
    title: 'DU Eligibility & Cutoff Calculator for CUET | MockMob',
    description:
      'Free tool: pick your CUET subjects, see every Delhi University programme you are eligible for, and compare the previous year’s college-wise cutoffs for your category.',
    priority: 0.95,
  },
  {
    path: '/cuet-subject-combination',
    title: 'CUET Subject Combination Planner for DU | MockMob',
    description:
      'Free planner: choose the DU programmes you want and the subjects you could take. See which CUET subject combination unlocks the most, checked against DU’s published eligibility rules.',
    priority: 0.95,
  },
  {
    path: '/cuet-mock-test-free',
    title: 'CUET Mock Test Free Online | MockMob',
    description:
      'Attempt free CUET mock tests online with timed practice, chapter-wise questions, performance insights, and exam-style revision.',
    priority: 0.95,
  },
  {
    path: '/cuet-previous-year-questions',
    title: 'CUET Previous Year Questions with Answers | MockMob',
    description:
      'Practise CUET previous year questions, understand exam patterns, revise high-value topics, and build a smarter PYQ routine.',
    priority: 0.92,
  },
  {
    path: '/cuet-practice-tests-online',
    title: 'CUET Practice Tests Online for UG Preparation | MockMob',
    description:
      'Practise CUET online tests by subject, chapter, and difficulty with analytics describing your practice record.',
    priority: 0.9,
  },
  {
    path: '/cuet-2027',
    title: 'CUET 2027: Exam Pattern, Expected Dates, Syllabus & Preparation | MockMob',
    description:
      'CUET UG 2027 guide: expected dates, CBT exam pattern, subject rules, marking scheme, and a month-by-month preparation plan.',
    priority: 0.95,
  },
  {
    path: '/about',
    title: 'About MockMob — The CUET-First Mock Test Platform',
    description: 'Why MockMob exists: one exam, machine-validated questions, and honest analytics for CUET aspirants.',
    priority: 0.5,
  },
  {
    path: '/contact',
    title: 'Contact MockMob — Support, Payments, and Partnerships',
    description: 'Reach the MockMob team for support, payment questions, question reports, and partnerships.',
    priority: 0.4,
  },
  // Auth pages carry no search value; excluded from the sitemap.
  {
    path: '/login',
    title: 'Login to MockMob',
    description: 'Log in to MockMob to continue CUET mock tests, saved questions, analytics, and practice history.',
    priority: 0.35,
    sitemap: false,
  },
  {
    path: '/signup',
    title: 'Create a Free MockMob Account',
    description: 'Create a free MockMob account and start CUET mock tests, question practice, and progress tracking.',
    priority: 0.45,
    sitemap: false,
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | MockMob',
    description: 'Read how MockMob collects, uses, and protects student account, practice, and payment data.',
    priority: 0.25,
  },
  {
    path: '/terms',
    title: 'Terms of Service | MockMob',
    description: 'Read the terms for using MockMob mock tests, community questions, premium features, and accounts.',
    priority: 0.25,
  },
  {
    path: '/refunds',
    title: 'Refund Policy | MockMob',
    description: 'Read MockMob cancellation and refund guidance for Pro subscriptions and payment issues.',
    priority: 0.25,
  },
];

export function absoluteUrl(path = '/') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteConfig.url.replace(/\/$/, '')}${cleanPath}`;
}

export function seoMetadata({ title, description, path = '/', images }) {
  const canonical = absoluteUrl(path);
  // Only set images when explicitly provided; an empty array would override
  // the app-level opengraph-image file convention and strip og:image.
  const imageFields = Array.isArray(images) && images.length > 0 ? { images } : {};
  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      siteName: siteConfig.name,
      title,
      description,
      url: canonical,
      ...imageFields,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...imageFields,
    },
  };
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function courseJsonLd({ name, description, path }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name,
    description,
    url: absoluteUrl(path),
    provider: {
      '@type': 'EducationalOrganization',
      name: siteConfig.name,
      url: siteConfig.url,
    },
    educationalLevel: 'Undergraduate entrance exam preparation',
    teaches: [
      'CUET mock test practice',
      'CUET previous year question solving',
      'CUET subject-wise revision',
      'Exam speed and accuracy improvement',
    ],
    audience: {
      '@type': 'EducationalAudience',
      educationalRole: 'student',
    },
  };
}

export function globalJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      '@id': `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      legalName: siteConfig.legalName,
      url: siteConfig.url,
      email: siteConfig.email,
      description: siteConfig.description,
      sameAs: siteConfig.socialLinks,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${siteConfig.url}/#website`,
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.description,
      publisher: {
        '@id': `${siteConfig.url}/#organization`,
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteConfig.url}/explore?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Course',
      '@id': `${siteConfig.url}/#cuet-course`,
      name: 'CUET UG Mock Test Preparation',
      description:
        'Online CUET UG preparation with mock tests, previous year questions, practice tests, analytics, and admission planning tools.',
      url: siteConfig.url,
      provider: {
        '@id': `${siteConfig.url}/#organization`,
      },
    },
  ];
}
