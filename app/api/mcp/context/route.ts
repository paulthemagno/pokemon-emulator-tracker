import { NextRequest, NextResponse } from 'next/server';
import { activeContextStore, activeContextUpdateSchema } from '@/lib/chatbot/active-context';
import { GET as getLive } from '../../live/route';
import { packGameContext } from '@/lib/chatbot/context-packer';
import { mergeLiveWithSavePcBoxes } from '@/lib/pokemon/pc-box-merge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isLocal(request: NextRequest) {
  const host = request.headers.get('host');
  if (!host) return false;
  try {
    const url = new URL(`http://${host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false;
    const origin = request.headers.get('origin');
    return !origin || origin === url.origin;
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  if (!isLocal(request)) return NextResponse.json({ success: false, error: 'Local access only' }, { status: 403 });
  const selected = activeContextStore.read();
  if (selected.success && selected.source === 'live') {
    const response = await getLive(new NextRequest(new URL('/api/live?fresh=1', request.url)));
    const live = await response.json();
    const current = activeContextStore.read();
    // The UI can change source while the request is in flight.
    if (current.success && current.sessionId === selected.sessionId && current.source === 'live') {
      if (live.success && live.data) {
        const data = mergeLiveWithSavePcBoxes(live.data, current.context.fullState ?? null);
        const context = packGameContext(data)!;
        context.timestamp = live.updatedAt;
        activeContextStore.refreshLive(current.sessionId!, { source: 'live', game: data.game,
          filename: current.filename, updatedAt: live.updatedAt, stale: live.stale === true,
          error: live.error, context });
      } else {
        activeContextStore.refreshLive(current.sessionId!, { source: 'live', game: current.game,
          filename: current.filename, updatedAt: current.updatedAt, stale: true,
          error: live.error ?? 'Live source unavailable', context: current.context });
      }
    }
  }
  return NextResponse.json(activeContextStore.read(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!isLocal(request)) return NextResponse.json({ success: false, error: 'Local access only' }, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ success: false, error: 'JSON required' }, { status: 415 });
  }
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 8_000_000) return NextResponse.json({ success: false, error: 'Context too large' }, { status: 413 });
    const parsed = activeContextUpdateSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid context' }, { status: 400 });
    activeContextStore.update(parsed.data);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to publish context' }, { status: 400 });
  }
}
