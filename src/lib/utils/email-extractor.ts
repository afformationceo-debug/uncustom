const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.\w+/g;

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

export function isLinktreeOrBioLink(url: string): boolean {
  const bioLinkDomains = [
    "linktr.ee", "linktree.com", "beacons.ai", "bio.link",
    "linkbio.co", "linkin.bio", "tap.bio", "campsite.bio",
    "carrd.co", "lnk.to", "hoo.be", "koji.to",
    "snipfeed.co", "stan.store",
  ];
  try {
    const parsed = new URL(url);
    return bioLinkDomains.some((domain) => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
}
