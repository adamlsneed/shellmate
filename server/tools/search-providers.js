// server/tools/search-providers.js
/**
 * Web search provider implementations.
 * Google is the default — no API key needed.
 * Brave and Perplexity are optional (require API keys).
 */

const MAX_RESULTS = 20;

/**
 * Google search via HTML scraping. No API key required.
 */
export async function googleSearch(query, count = 5) {
  try {
    count = Math.min(count, MAX_RESULTS);
    const params = new URLSearchParams({ q: query, num: count, hl: 'en' });
    const res = await fetch(`https://www.google.com/search?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      return `Google search error: ${res.status} ${res.statusText}`;
    }

    const html = await res.text();

    // Check for CAPTCHA / unusual traffic page
    if (html.includes('detected unusual traffic') || html.includes('/sorry/')) {
      return 'Google search is temporarily limited. Try again in a moment, or configure Brave Search as an alternative provider.';
    }

    // Check for JS-only page (no HTML results rendered server-side)
    if (html.includes('enablejs') || html.includes('/httpservice/retry/')) {
      return 'Google search is temporarily limited. Try again in a moment, or configure Brave Search as an alternative provider.';
    }

    return parseGoogleResults(html, count);
  } catch (err) {
    return `Google search error: ${err.message}`;
  }
}

/**
 * Parse Google search results from HTML.
 * Extracts title, URL, and snippet from result blocks.
 */
function parseGoogleResults(html, maxResults) {
  const results = [];

  // Match result blocks: <a href="/url?q=REAL_URL..."><h3>TITLE</h3></a> ... snippet
  // Google wraps results in <div class="g"> blocks
  const blockRegex = /<div class="[^"]*\bg\b[^"]*">[\s\S]*?<\/div>\s*<\/div>/g;
  const blocks = html.match(blockRegex) || [];

  for (const block of blocks) {
    if (results.length >= maxResults) break;

    // Extract URL from /url?q= redirect links
    const urlMatch = block.match(/href="\/url\?q=([^&"]+)/);
    if (!urlMatch) continue;
    const url = decodeURIComponent(urlMatch[1]);

    // Skip Google's own URLs
    if (url.includes('google.com/') && !url.includes('support.google.com')) continue;

    // Extract title from <h3>
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
      : url;

    // Extract snippet — text after the link block
    const snippetMatch = block.match(/<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim()
      : '';

    if (title || snippet) {
      results.push({ title, url, snippet });
    }
  }

  // Fallback: try simpler regex if the block approach found nothing
  if (results.length === 0) {
    const simpleRegex = /href="\/url\?q=(https?:\/\/[^&"]+)[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g;
    let match;
    while ((match = simpleRegex.exec(html)) !== null && results.length < maxResults) {
      const url = decodeURIComponent(match[1]);
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (url.includes('google.com/')) continue;
      results.push({ title, url, snippet: '' });
    }
  }

  if (results.length === 0) {
    return 'No results found.';
  }

  return results.map((r, i) =>
    `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
  ).join('\n\n');
}

/**
 * Brave Search API. Requires API key.
 */
export async function braveSearch(query, count = 5, apiKey) {
  if (!apiKey) return 'Brave Search not configured — no API key found.';
  try {
    const params = new URLSearchParams({ q: query, count: Math.min(count, MAX_RESULTS) });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) return `Brave Search error: ${res.status} ${res.statusText}`;
    const data = await res.json();
    const results = (data.web?.results || []).slice(0, count);
    if (results.length === 0) return 'No results found.';
    return results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description || ''}`
    ).join('\n\n');
  } catch (err) {
    return `Brave Search error: ${err.message}`;
  }
}

/**
 * Perplexity Search API. Requires API key.
 */
export async function perplexitySearch(query, count = 5, apiKey) {
  if (!apiKey) return 'Perplexity Search not configured — no API key found.';
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro',
        messages: [{ role: 'user', content: query }],
        max_tokens: 1000,
      }),
    });
    if (!res.ok) return `Perplexity error: ${res.status} ${res.statusText}`;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No results found.';
  } catch (err) {
    return `Perplexity error: ${err.message}`;
  }
}

/**
 * Route search to the configured provider.
 */
export async function routeSearch({ query, count = 5 }, context = {}) {
  const provider = context.searchProvider || 'google';
  switch (provider) {
    case 'brave':      return braveSearch(query, count, context.braveApiKey);
    case 'perplexity': return perplexitySearch(query, count, context.perplexityApiKey);
    case 'google':
    default:           return googleSearch(query, count);
  }
}
