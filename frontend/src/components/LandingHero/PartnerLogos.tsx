export function PartnerLogos() {
  const partners = [
    {
      name: "BIOHARVEST",
      role: "Crop Genomics",
      icon: (
        <svg
          className="w-6 h-6 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
      ),
    },
    {
      name: "CERES LABS",
      role: "Phytopathology",
      icon: (
        <svg
          className="w-6 h-6 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m18 15-6-6-6 6" />
          <path d="m18 9-6-6-6 6" />
          <path d="M12 2v20" />
        </svg>
      ),
    },
    {
      name: "VERDANT GIS",
      role: "Spatial Intelligence",
      icon: (
        <svg
          className="w-6 h-6 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      ),
    },
    {
      name: "AGRI-SYNERGY",
      role: "FAO-56 Telemetry",
      icon: (
        <svg
          className="w-6 h-6 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-14 sm:mt-18 text-center animate-hero-fade [animation-delay:400ms]">
      <p className="text-xs sm:text-sm font-medium tracking-wide uppercase text-slate-400 mb-7">
        List of some of the top agricultural cooperatives & agronomy institutes
      </p>

      {/* Grid / Flex of Partner Logos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 sm:gap-8 items-center justify-items-center">
        {partners.map((partner) => (
          <div
            key={partner.name}
            className="flex items-center gap-2.5 text-slate-400 hover:text-white transition-all duration-300 opacity-75 hover:opacity-100 hover:scale-105 cursor-default group"
          >
            <span className="text-slate-400 group-hover:text-emerald-400 transition-colors">
              {partner.icon}
            </span>
            <div className="text-left">
              <span className="font-display font-extrabold text-sm sm:text-base tracking-wider block leading-tight">
                {partner.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:block leading-none">
                {partner.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
