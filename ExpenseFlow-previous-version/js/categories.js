// ============================================================
// EXPENSE CATEGORIES — Full Chart of Accounts
// ============================================================
const categoriesData = {
    "Statutory Filings & Registrations": {
        "ROC Filings": ["Annual returns", "MCA compliance."],
        "Tax Filings": ["GST", "TDS", "Advance Tax", "Income Tax Return"],
        "Business Permits": ["Trade License", "Shops Act", "FSSAI"]
    },
    "Financial Compliance": {
        "Audit & Assurance": ["Statutory Audits", "Internal Audits"]
    },
    "Legal & Contractual Compliance": {
        "Contracts & Agreements": ["Vendor Agreements", "Client Agreements", "Employee Agreements", "Product Terms & conditions", "Website Terms and Conditions"],
        "Intellectual Property Filings": ["Trademarks", "Copyrights", "Patents"],
        "Labor Law Compliance": ["Gratuity", "Maternity", "Minimum wages"],
        "Data Protection & Privacy": ["GDPR", "DPDP Act Compliance"]
    },
    "Industry-Specific Compliance": {
        "Sectoral Regulations": ["RBI", "SEBI", "IRDAI"],
        "Environmental Compliance": ["PCB", "ESG"],
        "Health & Safety Regulations": ["Workplace safety norms"]
    },
    "Infrastructure & Utilities": {
        "Office Space": ["Rent", "Water bill", "Electricity Bill", "Internet", "Co Working spaces"],
        "Digital Infrastructure": ["Cloud hosting", "SAAS Tools"],
        "Maintenance": ["Repairs", "Annual Maintenance contracts"],
        "Facilities Management": ["Cleaning", "security", "Office Upkeep"]
    },
    "Procurement & Consumables": {
        "Office Supplies": ["Stationery", "Pantry items", "Printer cartridges."],
        "Software Credits": ["Whatsapp Credits", "Jogg AI Credits", "AI Credits"]
    },
    "Telecom": {
        "Phone bills": ["Internet plans."],
        "Domain & Hosting": ["Regular domain renewals", "Shared hosting"]
    },
    "Transport & Logistics": {
        "Company Vehicles": ["Maintenance", "Fuel", "Repairs", "Tolls", "Parking"],
        "Courier & Delivery Costs": ["Shipping documents", "Packages"]
    },
    "Vendor & Partner Services": {
        "Outsourced Operations": ["Housekeeping", "IT support", "Cafeteria"],
        "AMC Vendors": ["Printers", "Networking", "CCTV"],
        "Third-Party Providers": ["Cloud service retainers", "Outsourced HR ops."],
        "Operational Retainers": ["Managed services contracts."]
    },
    "Legal & Regulatory Safeguards": {
        "Litigation Costs": ["Lawyer retainers", "Arbitrations", "Settlements"],
        "Regulatory Fines": ["Compliance Penalties"]
    },
    "Operational Risk Cover": {
        "Business Continuity Planning": ["Contingency Infrastructure"],
        "Crisis Fund Allocation": ["Crisis reserve fund", "Risk- Adjusted Provisions"]
    },
    "Business Insurance": {
        "General Business Insurance": ["Property", "Fire", "Liability Cover"],
        "Cyber Insurance": ["Data", "IT infra protection."],
        "Vehicle Insurance": ["Company fleet/transport cover"],
        "Workplace Insurance": ["Equipment & systems"]
    },
    "Hardware & Devices": {
        "Laptops": ["Desktops", "Tablets", "Mobiles", "Printers", "Scanners", "Peripherals"]
    },
    "Servers & Networking": {
        "Cloud servers (AWS, Azure, GCP)": ["On-prem servers & racks", "Routers", "Switches", "Networking gear", "Monitoring tools", "Bandwidth upgrades"]
    },
    "IT Systems & Infra": {
        "Security & admin tools (password managers, SSO)": [],
        "Storage": ["NAS", "External Drives", "Cloud Storage Subscriptions"]
    },
    "Brand Development": {
        "Brand strategy consultants": [],
        "Social Media Agency": [],
        "Website Development": ["UX & UI", "Brand films, visual assets", "Photography"]
    },
    "Media & Communications": {
        "PR retainers": [],
        "Press kits": ["Media outreach", "Thought-leadership articles", "Brand documentaries", "Podcasts"],
        "Content & Creative Production": ["Blog"],
        "Reels & Videos": [],
        "Graphic Design Posters": [],
        "Photography": ["Product shoots"]
    },
    "Community & Ecosystem": {
        "Startup ecosystem sponsorships": [],
        "Meetups, local events, founder dinners": [],
        "Community funds / micro-grants": [],
        "Volunteering initiatives": []
    },
    "Product Prototyping & MVPs": {
        "Prototype builds": [],
        "MVP testing budgets": [],
        "Low-code/rapid experiment tools": []
    },
    "User Research & Testing": {
        "Paid user testing": [],
        "Usability testing platforms": [],
        "Research reports": []
    },
    "Experimental Features & A/B Testing": {
        "Feature-flagging tools": [],
        "Experiment-specific dev hours": []
    },
    "Analytics & Data Tools": {
        "Product analytics software": [],
        "Heatmaps/session recording": [],
        "Experiment tracking dashboards": []
    },
    "Sandbox & Dev Environments": {
        "Paid API access": [],
        "Sandbox tools, test servers, staging environments": [],
        "Experiment-focused infra spend": []
    },
    "Client Entertainment & Hospitality": {
        "Business dinners / luncheons": [],
        "Hotel stays for key client visits": [],
        "Cultural experiences (concert tickets, curated tours for visiting clients)": [],
        "Client travel reimbursements (pickup/drop, premium cab service)": [],
        "Corporate gifting (wine, hampers, watches, premium items)": []
    },
    "Team Hospitality & Celebrations": {
        "Catering for team offsites, hackathons, retreats": [],
        "In-office celebration costs (Diwali, Christmas, New Year, team milestones)": [],
        "Outings (team dinners, movie nights, escape rooms, adventure parks)": [],
        "Party budgets (DJ, AV, décor, food/drinks for office events)": []
    },
    "Incentives & Spot Bonuses": {
        "Instant recognition vouchers (Amazon, Flipkart, etc.)": [],
        "Festival/holiday bonuses (cash, gift cards)": [],
        "Small performance bonuses (linked to project completions)": [],
        "Contest prizes for team competitions/hackathons": [],
        "Peer-to-peer recognition rewards": []
    },
    "Perks & Welcome Kits": {
        "New hire welcome kits (hoodies, bottles, stationary, tech accessories)": [],
        "Customer welcome kits (branded goodies, onboarding gifts)": [],
        "Milestone gifts (5 years with company, promotion, wedding, newborn gifts for staff)": [],
        "Birthday/anniversary gifts for employees or clients": []
    },
    "Networking & Social Hosting": {
        "Hosting mixers, informal dinners for networking": [],
        "Wine & cheese evenings or café meetups": [],
        "Club memberships for entertaining clients": [],
        "Lounge access or VIP tickets for events/sports matches": []
    },
    "Premium Services for Experience": {
        "Event photographers/videographers for parties": [],
        "Concierge services (travel concierge for clients/execs)": [],
        "Hospitality staff (servers, bartenders for parties)": [],
        "Venue rental for offsites or celebrations": []
    },
    "Special Morale Boosters": {
        "Surprise treats (ice-cream truck, pizza day, snack hampers)": [],
        "Relaxation perks (spa vouchers, wellness experiences)": [],
        "Adventure activities (rafting, trekking, paintball)": [],
        "Seasonal perks (summer coolers, winter hot chocolate bar)": []
    },
    "Paid Acquisition": {
        "Google Ads (search, display, YouTube)": [],
        "Meta Ads (Facebook, Instagram)": [],
        "LinkedIn Ads (for B2B lead generation)": [],
        "Twitter/X Ads (community & topical reach)": [],
        "Emerging channels (Reddit, Quora, niche ad networks)": [],
        "Affiliate program payouts": [],
        "Influencer marketing spend": []
    },
    "Content & Creative Production": {
        "Blog/article production (freelancers, agencies)": [],
        "Video production (explainer, testimonials, product demos)": [],
        "Graphic design (infographics, campaign visuals)": [],
        "Photography (product shoots, lifestyle branding)": [],
        "Podcast creation & distribution": [],
        "Copywriting & ad creatives": []
    },
    "Tools": {
        "CRM systems (HubSpot, Salesforce)": [],
        "Marketing automation (Mailchimp, ActiveCampaign, Klaviyo)": [],
        "Landing page builders (Unbounce, Webflow, Instapage)": [],
        "SEO & keyword tools (SEMRush, Ahrefs, Moz)": [],
        "Heatmaps & CRO tools (Hotjar, CrazyEgg, Optimizely)": [],
        "Analytics subscriptions (Google Analytics premium, Mixpanel, Amplitude)": []
    },
    "Sales Enablement": {
        "Outreach tools (Apollo, LinkedIn Sales Navigator)": [],
        "Email sequencing platforms (Outreach.io, Salesloft)": [],
        "Proposal software (Proposify, PandaDoc)": [],
        "Presentation decks, collateral design": [],
        "Demos & sandbox environments for prospects": [],
        "Customer testimonials/case study production": []
    },
    "Campaigns & Sponsorships": {
        "Trade show participation fees": [],
        "Event sponsorships (startup summits, hackathons, niche conferences)": [],
        "Community partnerships (incubators, coworking spaces)": [],
        "Cause-based marketing tie-ups (NGOs, CSR-linked campaigns)": [],
        "Giveaway campaigns & contests (prizes, logistics)": []
    },
    "Brand Visibility Investments": {
        "PR campaigns & advertorials in business media": [],
        "Podcast/radio sponsorships": [],
        "Outdoor ads (billboards, transit ads, co-branding at events)": [],
        "Social proof investments (review platforms like G2, Trustpilot)": [],
        "Listing fees on app stores/directories": []
    },
    "Sales Support & Collateral": {
        "Printed brochures, flyers, sales kits": [],
        "Swag for prospects (mugs, T-shirts, USBs with product demos)": [],
        "Demo booth setups (tables, roll-up banners, displays)": [],
        "Branded decks and templates": []
    },
    "Recruitment & Hiring": {
        "Job postings & advertisements": [],
        "Recruitment agency fees": [],
        "Referral bonuses": [],
        "Interview logistics (tests, travel reimbursements, etc.)": [],
        "Background verification checks": []
    },
    "Salaries & Wages": {
        "Full-time employee salaries": [],
        "Part-time staff wages": [],
        "Contractor / consultant payments": [],
        "Overtime payments": [],
        "Freelancers": []
    },
    "Employee Benefits": {
        "Health insurance contributions": [],
        "Retirement funds (PF, NPS, gratuity)": [],
        "Wellness allowances (gym, therapy, etc.)": [],
        "Paid leave (vacation, sick leave, maternity/paternity) payouts": [],
        "Food coupons / meal benefits": []
    },
    "Learning & Development": {
        "Online courses, certifications": [],
        "Training workshops, bootcamps": [],
        "External trainers / guest speakers": [],
        "Leadership programs": [],
        "Upskilling allowances (books, software courses, etc.)": []
    },
    "Performance & Growth Management": {
        "Appraisal systems & tools (HR software subscriptions)": [],
        "Performance bonuses, incentives": [],
        "Equity/stock option allocations": [],
        "Promotion & career planning expenses": []
    },
    "HR Operations & Compliance": {
        "Payroll management software": [],
        "HRMS systems (attendance, leave management)": [],
        "Labor law compliance filings": [],
        "Consultancy fees for HR/legal compliance": [],
        "Audit fees (specific to HR/payroll)": []
    },
    "Employee Exit Costs": {
        "Severance packages": [],
        "Outplacement support (helping employees transition)": [],
        "Final settlements": [],
        "Legal/mediation costs (in disputes if any)": []
    },
    "Business Travel": {
        "Airfare (domestic & international)": [],
        "Train, bus, cab, car rentals": [],
        "Fuel reimbursements": [],
        "Visa fees & travel insurance": []
    },
    "Accommodation & Logistics": {
        "Hotels, guest houses, service apartments": [],
        "Meals & per diem allowances": [],
        "Local transport (Uber, Ola, metro passes, etc.)": [],
        "Travel booking fees / aggregators": []
    },
    "Industry Events & Conferences": {
        "Tickets / passes for conferences & seminars": [],
        "Stall / booth rentals at expos": [],
        "Sponsorships for industry events": [],
        "Event branding (standees, flyers, merchandise)": [],
        "Networking dinners / mixers": []
    },
    "Client Events": {
        "Client entertainment (meals, outings, hospitality)": [],
        "Launch parties / press events": [],
        "Product demo sessions / roadshows": [],
        "Gifting for clients during events": []
    },
    "Internal Company Events": {
        "Annual day, town halls, employee offsites": [],
        "Training camps / leadership retreats": [],
        "Internal celebrations (festival, milestone parties)": [],
        "Team-bonding trips": []
    },
    "Virtual Events (if applicable)": {
        "Webinar hosting platforms (Zoom Webinar, Airmeet, Hopin)": [],
        "Paid guest speakers for virtual sessions": [],
        "Digital event marketing & promotion": [],
        "Recording / post-production costs": []
    },
    "Miscellaneous & Contingency": {
        "Emergency travel arrangements": [],
        "Event insurance": [],
        "Misc. logistics (couriering event material, props, etc.)": []
    }
};

// ============================================================
// EXPENSE CATEGORIES GROUPING (CORE BRIGHT)
// ============================================================
const coreBrightGroups = {
    "C — Compliance": [
        "Statutory Filings & Registrations",
        "Financial Compliance",
        "Legal & Contractual Compliance",
        "Industry-Specific Compliance"
    ],
    "O — Operations": [
        "Infrastructure & Utilities",
        "Procurement & Consumables",
        "Telecom",
        "Transport & Logistics",
        "Vendor & Partner Services"
    ],
    "R — Risk & Reserves": [
        "Legal & Regulatory Safeguards",
        "Operational Risk Cover",
        "Business Insurance"
    ],
    "E — Equipment & Systems": [
        "Hardware & Devices",
        "Servers & Networking",
        "IT Systems & Infra"
    ],
    "B — Brand & Culture": [
        "Brand Development",
        "Media & Communications",
        "Community & Ecosystem"
    ],
    "R — R&D / Innovation": [
        "Product Prototyping & MVPs",
        "User Research & Testing",
        "Experimental Features & A/B Testing",
        "Analytics & Data Tools",
        "Sandbox & Dev Environments"
    ],
    "I — Incentives & Hospitality": [
        "Client Entertainment & Hospitality",
        "Team Hospitality & Celebrations",
        "Incentives & Spot Bonuses",
        "Perks & Welcome Kits",
        "Networking & Social Hosting",
        "Premium Services for Experience",
        "Special Morale Boosters"
    ],
    "G — Growth (Marketing & Sales)": [
        "Paid Acquisition",
        "Content & Creative Production",
        "Tools",
        "Sales Enablement",
        "Campaigns & Sponsorships",
        "Brand Visibility Investments",
        "Sales Support & Collateral"
    ],
    "H — Human Resources": [
        "Recruitment & Hiring",
        "Salaries & Wages",
        "Employee Benefits",
        "Learning & Development",
        "Performance & Growth Management",
        "HR Operations & Compliance",
        "Employee Exit Costs"
    ],
    "T — Tours & Events": [
        "Business Travel",
        "Accommodation & Logistics",
        "Industry Events & Conferences",
        "Client Events",
        "Internal Company Events",
        "Virtual Events (if applicable)",
        "Miscellaneous & Contingency"
    ]
};
