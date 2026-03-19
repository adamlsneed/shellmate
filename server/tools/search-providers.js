// server/tools/search-providers.js
/**
 * Web search provider implementations.
 * DuckDuckGo is the default — no API key needed, reliable HTML endpoint.
 * Brave and Perplexity are optional (require API keys).
 */

const MAX_RESULTS = 20;

/**
 * DuckDuckGo search via HTML scraping. No API key required.
 * Uses the HTML-only endpoint designed for non-JS clients.
 */
export async function duckduckgoSearch(query, count = 5) {
  try {
    count = Math.min(count, MAX_RESULTS);
    const params = new URLSearchParams({ q: query });
    const res = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      body: params,
    });

    if (!res.ok) {
      return `Web search error: ${res.status} ${res.statusText}`;
    }

    const html = await res.text();
    return parseDuckDuckGoResults(html, count);
  } catch (err) {
    return `Web search error: ${err.message}`;
  }
}

/**
 * Parse DuckDuckGo HTML results.
 */
function parseDuckDuckGoResults(html, maxResults) {
  const results = [];

  // DuckDuckGo HTML results are in <a class="result__a" href="URL">TITLE</a>
  // with snippets in <a class="result__snippet" ...>SNIPPET</a>
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const urls = [];
  const titles = [];
  let match;

  while ((match = resultRegex.exec(html)) !== null) {
    let url = match[1];
    // DDG wraps URLs in a redirect — extract the real URL
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
    urls.push(url);
    titles.push(match[2].replace(/<[^>]+>/g, '').trim());
  }

  const snippets = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim());
  }

  for (let i = 0; i < Math.min(urls.length, maxResults); i++) {
    results.push({
      title: titles[i] || urls[i],
      url: urls[i],
      snippet: snippets[i] || '',
    });
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
  const provider = context.searchProvider || 'duckduckgo';
  switch (provider) {
    case 'brave':      return braveSearch(query, count, context.braveApiKey);
    case 'perplexity': return perplexitySearch(query, count, context.perplexityApiKey);
    case 'duckduckgo':
    case 'google':     // backwards compat — routes to DuckDuckGo
    default:           return duckduckgoSearch(query, count);
  }
}
