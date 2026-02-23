// Improved email regex: requires alphanumeric start/end, min 2-char TLD
const EMAIL_REGEX = /[a-zA-Z0-9][\w.-]*[a-zA-Z0-9]@[a-zA-Z0-9][\w.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}/g;

export function extractEmailFromBio(bio: string | null | undefined): string | null {
  if (!bio) return null;
  const matches = bio.match(EMAIL_REGEX);
  return matches?.[0] ?? null;
}

export function extractLinksFromBio(bio: string | null | undefined, externalUrl?: string | null): string[] {
  const links: string[] = [];
  if (externalUrl && typeof externalUrl === "string" && externalUrl.trim()) {
    links.push(externalUrl.trim());
  }
  if (!bio) return links;
  const urlRegex = /https?:\/\/[^\s,)}\]]+/g;
  const bioUrls = bio.match(urlRegex);
  if (bioUrls) {
    for (const url of bioUrls) {
      if (!links.includes(url)) links.push(url);
    }
  }
  return links;
}

const BIO_LINK_DOMAINS = [
  "linktr.ee", "linktree.com", "beacons.ai", "bio.link",
  "linkbio.co", "linkin.bio", "tap.bio", "campsite.bio",
  "carrd.co", "lnk.to", "hoo.be", "koji.to",
  "snipfeed.co", "stan.store", "lit.link", "fanme.link",
  "fanicon.net", "potofu.me", "instabio.cc", "linkr.bio",
  "msha.ke", "profcard.info", "milkshake.app", "bio.site",
  "lynkfire.com", "withkoji.com", "direct.me", "lnk.bio",
  "linkpop.com", "solo.to", "manylink.co", "flowpage.com",
];

const SKIP_DOMAINS = [
  "youtube.com", "youtu.be", "tiktok.com", "twitter.com", "x.com",
  "instagram.com", "facebook.com", "amazon.com", "amzn.to",
  "amazon.co.jp", "amazon.co.uk", "rakuten.co.jp", "shopee",
  "lazada", "qoo10", "coupang.com", "naver.com", "google.com",
  "apple.com", "spotify.com", "music.apple.com", "open.spotify.com",
];

export function isLinktreeOrBioLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return BIO_LINK_DOMAINS.some((domain) => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
}

export function isEmailExtractableLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    // Skip known domains that never have personal emails
    if (SKIP_DOMAINS.some((domain) => host.includes(domain))) return false;
    // Always include known bio-link services
    if (BIO_LINK_DOMAINS.some((domain) => host.includes(domain))) return true;
    // Include personal domains/websites (could have contact email)
    return true;
  } catch {
    return false;
  }
}
