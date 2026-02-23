/* Real SVG platform logos used across the landing page */
export function InstagramLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-grad)" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
    </svg>
  );
}

export function TikTokLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#010101" />
      <path d="M16.5 4.5c-.2 1.6.4 2.8 1.3 3.6.9.7 2 1 2.7 1v2.5c-1.2 0-2.3-.4-3.2-1v5.2c0 3.5-3.7 5.5-6.5 3.7-1.8-1.2-2.6-3.5-1.8-5.6.8-2.1 3-3.3 5.1-2.9v2.6c-.6-.2-1.4-.1-1.9.3-.8.5-1.1 1.5-.7 2.4.4.9 1.4 1.3 2.3 1 .9-.3 1.4-1.1 1.4-2.1V4.5h1.3z" fill="white" />
      <path d="M16.5 4.5c-.2 1.6.4 2.8 1.3 3.6.9.7 2 1 2.7 1v2.5c-1.2 0-2.3-.4-3.2-1v5.2c0 3.5-3.7 5.5-6.5 3.7-1.8-1.2-2.6-3.5-1.8-5.6" fill="none" stroke="#25F4EE" strokeWidth="0.3" opacity="0.6" />
      <path d="M15.2 4.5c-.2 1.6.4 2.8 1.3 3.6" fill="none" stroke="#FE2C55" strokeWidth="0.3" opacity="0.6" />
    </svg>
  );
}

export function YoutubeLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#FF0000" />
      <path d="M10 15.5V8.5L16 12L10 15.5Z" fill="white" />
    </svg>
  );
}

export function TwitterLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#000000" />
      <path d="M13.3 10.8L17.5 6H16.3L12.8 10.1L10 6H6.5L10.9 12.7L6.5 18H7.7L11.4 13.4L14.4 18H17.9L13.3 10.8ZM12 12.8L11.5 12.1L8.1 6.8H9.6L12.4 10.8L12.9 11.5L16.3 17.2H14.8L12 12.8Z" fill="white" />
    </svg>
  );
}

export function ApifyLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#00C853" />
      <path d="M7 17L12 7L17 17H14.5L12 12L9.5 17H7Z" fill="white" />
    </svg>
  );
}

export function SupabaseLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#1C1C1C" />
      <path d="M13.5 19.5c-.3.4-.9.1-.9-.4V13h5.3c.8 0 1.2-.9.7-1.5L11.5 4.5c-.3-.4-.9-.1-.9.4V11H5.4c-.8 0-1.2.9-.7 1.5l7.1 7z" fill="#3ECF8E" />
      <path d="M13.5 19.5c-.3.4-.9.1-.9-.4V13h5.3c.8 0 1.2-.9.7-1.5" fill="none" stroke="#3ECF8E" strokeWidth="0" opacity="0.5" />
    </svg>
  );
}

export function ResendLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#000" />
      <path d="M7 7h6a4 4 0 010 8h-2l4 3v-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function AllPlatformBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <InstagramLogo className="w-5 h-5" />
      <TikTokLogo className="w-5 h-5" />
      <YoutubeLogo className="w-5 h-5" />
      <TwitterLogo className="w-5 h-5" />
    </div>
  );
}
