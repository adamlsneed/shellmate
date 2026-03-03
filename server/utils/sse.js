export function initSse(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

export function sendSse(res, type, data) {
  res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
}
