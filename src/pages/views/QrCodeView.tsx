/**
 * src/pages/views/QrCodeView.tsx — „QR-Code“: full-screen QR of the feedback form of the active interaction.
 *
 * ROUTE   #/ansicht/qr-code?record=<interaktion id> — outside the dashboard chrome.
 * LIVE    refreshes every 10 s through useLiveRecords.
 * READS   interaktionen (veranstaltung, reihenfolge, frage, erlaeuterung, aktiv) — the filter below is vSQL, keep it.
 * SHOWS   the interaction of the pinned record's event whose aktiv=true; none → „Gerade ist keine Interaktion aktiv“.
 * JOIN    <PublicPageQr entity="veranstaltungen" …> builds the link.
 */
import { useLiveRecord, useLiveRecords } from '@/hooks/useLiveRecords';
import { tx } from '@/i18n';
import { countOf } from '@/config/plan';
import { PublicPageQr } from '@/components/widgets/PublicPageQr';
import { extractRecordId } from '@/services/livingAppsService';

export default function QrCodeView() {
  const pinned = (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record') ?? '').replace(/["\\]/g, '');
  const interaktionen = useLiveRecords('interaktionen', { intervalMs: 10000, query: { filter: "r.v_aktiv == True and r.v_aktiv == True" } });
  const feedbacks = useLiveRecords('feedbacks', { intervalMs: 10000 });
  const pinnedRec = useLiveRecord('interaktionen', pinned, { intervalMs: 10000 });
  const eventId = extractRecordId(pinnedRec.record?.fields.veranstaltung);
  const active = eventId
    ? interaktionen.records.find(r => extractRecordId(r.fields.veranstaltung) === eventId) ?? null
    : null;
  const count = active ? feedbacks.records.filter(f => extractRecordId(f.fields.interaktion) === active.record_id).length : 0;
  const big = { fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' } as const;
  const mid = { fontSize: 'clamp(1.25rem, 2.2vh, 2.25rem)' } as const;
  const loaded = !pinnedRec.loading && !interaktionen.loading;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-6 text-center text-foreground">
      {!pinned ? (
        <p data-view-no-record style={big}>{tx('Bitte über die Übersicht öffnen — diese Ansicht zeigt einen bestimmten Datensatz.')}</p>
      ) : interaktionen.error && interaktionen.records.length === 0 ? (
        <p role="alert" data-live-error className="text-destructive" style={big}>
          {interaktionen.unauthorized ? tx('Bitte melde dich an, um diese Ansicht zu sehen.') : tx('Die Daten konnten nicht geladen werden.')}
        </p>
      ) : !loaded ? null : !active ? (
        <p style={big}>{tx('Gerade ist keine Interaktion aktiv')}</p>
      ) : (
        <>
          <div className="max-w-5xl space-y-3">
            <h1 className="whitespace-pre-line font-semibold" style={{ fontSize: 'clamp(2rem, 4.5vh, 4.5rem)' }}>{active.fields.frage}</h1>
            {active.fields.erlaeuterung && (
              <p className="whitespace-pre-line text-muted-foreground" style={big}>{active.fields.erlaeuterung}</p>
            )}
          </div>
          {eventId && <PublicPageQr entity="veranstaltungen" recordId={eventId} page="feedback" size="50vh" linkClassName="text-muted-foreground" />}
        </>
      )}
      {feedbacks.error && feedbacks.records.length === 0 && <p role="alert" data-live-error className="text-destructive" style={mid}>{tx('Die Daten konnten nicht geladen werden.')}</p>}
      {pinned && (
        <p className="flex items-center gap-4 text-muted-foreground" style={mid}>
          <span className="inline-flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-full ${interaktionen.stale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {interaktionen.stale ? tx('Pause') : tx('Live')}
          </span>
          {active && <span>{countOf('feedbacks', count, tx('Feedbacks'))}</span>}
        </p>
      )}
    </main>
  );
}
