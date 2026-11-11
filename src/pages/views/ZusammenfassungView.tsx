/**
 * src/pages/views/ZusammenfassungView.tsx — „Zusammenfassung“: all feedbacks of one interaction in a big editable text.
 *
 * ROUTE   #/ansicht/zusammenfassung?record=<zusammenfassung id> — outside the dashboard chrome.
 * LIVE    static — loads once.
 * READS   interaktionen, feedbacks, zusammenfassungen.
 * COMPOSE Vorprompt, then every feedback (oldest first) as „Kürzel: Text“, then Endprompt, when the stored text is empty;
 *         „Neu zusammenführen“ asks twice before overwriting. The overview creates the record, the KI answer belongs to its flow.
 */
import { useLiveRecords } from '@/hooks/useLiveRecords';
import { tx } from '@/i18n';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { ViewTextEditor } from '@/components/blocks/ViewTextEditor';

export default function ZusammenfassungView() {
  const pinned = (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record') ?? '').replace(/["\\]/g, '');
  const interaktionen = useLiveRecords('interaktionen', { intervalMs: 0 });
  const feedbacks = useLiveRecords('feedbacks', { intervalMs: 0 });
  const zusammenfassungen = useLiveRecords('zusammenfassungen', { intervalMs: 0 });
  const zusammenfassungenEdit = zusammenfassungen.records.find(r => r.record_id === pinned) ?? null;
  const pinnedInteraktion = extractRecordId(zusammenfassungenEdit?.fields.interaktion);
  const interaktion = interaktionen.records.find(r => r.record_id === pinnedInteraktion) ?? null;
  const myFeedbacks = feedbacks.records
    .filter(f => extractRecordId(f.fields.interaktion) === pinnedInteraktion)
    .sort((a, b) => (a.createdat ?? '').localeCompare(b.createdat ?? ''));
  const loaded = ![interaktionen, feedbacks, zusammenfassungen].some(x => x.loading);
  const anyError = [interaktionen, feedbacks, zusammenfassungen].some(x => x.error);

  const compose = () => {
    if (!loaded || !interaktion) return null;
    const parts: string[] = [];
    if (interaktion.fields.vorprompt?.trim()) parts.push(interaktion.fields.vorprompt.trim());
    if (myFeedbacks.length === 0) parts.push(tx('Noch keine Feedbacks'));
    else parts.push(myFeedbacks.map(f => `${f.fields.kuerzel ?? '—'}: ${(f.fields.feedback_text ?? '').trim()}`).join('\n\n'));
    if (interaktion.fields.endprompt?.trim()) parts.push(interaktion.fields.endprompt.trim());
    return parts.join('\n\n');
  };

  const big = { fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' } as const;
  return (
    <main className="min-h-dvh space-y-6 bg-background p-6 text-foreground md:p-10">
      {!pinned && <p data-view-no-record style={big}>{tx('Bitte über die Übersicht öffnen — diese Ansicht zeigt einen bestimmten Datensatz.')}</p>}
      {interaktion && (
        <header className="space-y-2">
          <h1 className="whitespace-pre-line font-semibold" style={{ fontSize: 'clamp(2rem, 4.5vh, 4.5rem)' }}>{interaktion.fields.frage}</h1>
          {interaktion.fields.erlaeuterung && (
            <p className="whitespace-pre-line text-muted-foreground" style={big}>{interaktion.fields.erlaeuterung}</p>
          )}
        </header>
      )}
      {pinned && loaded && !anyError && !zusammenfassungenEdit && <p style={big}>{tx('Diese Zusammenfassung wurde nicht gefunden.')}</p>}
      {zusammenfassungenEdit && (
        <>
          <ViewTextEditor
            field="zusammenfassung_text"
            recordId={zusammenfassungenEdit.record_id}
            value={String(zusammenfassungenEdit.fields.zusammenfassung_text ?? '')}
            save={async text => {
              await LivingAppsService.updateZusammenfassungenEntry(zusammenfassungenEdit.record_id, { zusammenfassung_text: text });
              zusammenfassungen.apply(zusammenfassungenEdit.record_id, { zusammenfassung_text: text });
            }}
            compose={compose}
            blocked={anyError ? tx('Die Daten konnten nicht geladen werden — es wird nichts zusammengeführt oder gespeichert.') : null}
          />
          {zusammenfassungenEdit.fields.ki_antwort && (
            <section className="space-y-2">
              <h2 className="font-semibold" style={{ fontSize: 'clamp(1.25rem, 2.2vh, 2.25rem)' }}>{tx('Antwort der KI')}</h2>
              <p className="whitespace-pre-line rounded-2xl bg-card p-6" style={{ fontSize: 'clamp(1.25rem, 2.6vh, 2.75rem)' }}>{zusammenfassungenEdit.fields.ki_antwort}</p>
            </section>
          )}
        </>
      )}
      {anyError && [interaktionen, feedbacks, zusammenfassungen].every(x => x.records.length === 0) && (
        <p role="alert" data-live-error className="text-destructive" style={big}>
          {interaktionen.unauthorized ? tx('Bitte melde dich an, um diese Ansicht zu sehen.') : tx('Die Daten konnten nicht geladen werden.')}
        </p>
      )}
      {interaktionen.error && interaktionen.records.length === 0 && <p role="alert" data-live-error className="text-destructive" style={big}>{tx('Die Daten konnten nicht geladen werden.')}</p>}
      {feedbacks.error && feedbacks.records.length === 0 && <p role="alert" data-live-error className="text-destructive" style={big}>{tx('Die Daten konnten nicht geladen werden.')}</p>}
      {zusammenfassungen.error && zusammenfassungen.records.length === 0 && <p role="alert" data-live-error className="text-destructive" style={big}>{tx('Die Daten konnten nicht geladen werden.')}</p>}
    </main>
  );
}
