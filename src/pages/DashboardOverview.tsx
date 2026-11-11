// Composition: no urgent signal → the ordered interaction list of the chosen event is the hero (hand-built:
// KanbanWidget rejected — there is no status lookup, the steps are a fixed ORDER with two quick actions per step).
// variant="wide" + StatStrip; band below: Zusammenfassungen ohne KI-Antwort + neue Abschlussbewertungen.
// Mobile: the list is a single column of cards, the event chips scroll horizontally.
import { useMemo, useState } from 'react';
import { differenceInDays, format, parseISO } from 'date-fns';
import { IconPlus, IconQrcode, IconSparkles, IconPlayerPlay, IconMessage, IconStar, IconCalendarEvent } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor, countOf, viewHref } from '@/config/plan';
import type { Interaktionen } from '@/types/app';
import { extractRecordId, LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { Button } from '@/components/ui/button';

type Filter = 'all' | 'noAnswer';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { veranstaltungen, interaktionen, feedbacks, zusammenfassungen, abschlussbewertungen, setInteraktionen, fetchAll } = data;
  const clock = useClock();

  const activate = async (rec: Interaktionen): Promise<string | void> => {
    const eventId = extractRecordId(rec.fields.veranstaltung);
    const siblings = interaktionen.filter(i => i.record_id !== rec.record_id && i.fields.aktiv && extractRecordId(i.fields.veranstaltung) === eventId);
    const snapshot = interaktionen;
    setInteraktionen(prev => prev.map(i =>
      i.record_id === rec.record_id ? { ...i, fields: { ...i.fields, aktiv: true } }
        : siblings.some(s => s.record_id === i.record_id) ? { ...i, fields: { ...i.fields, aktiv: false } } : i));
    try {
      for (const s of siblings) await LivingAppsService.updateInteraktionenEntry(s.record_id, { aktiv: false });
      await LivingAppsService.updateInteraktionenEntry(rec.record_id, { aktiv: true });
      undoToast(tx`Interaktion ${rec.fields.reihenfolge ?? ''} ist jetzt aktiv`, async () => {
        setInteraktionen(snapshot);
        try {
          await LivingAppsService.updateInteraktionenEntry(rec.record_id, { aktiv: false });
          for (const s of siblings) await LivingAppsService.updateInteraktionenEntry(s.record_id, { aktiv: true });
        } catch { void fetchAll(); }
      });
    } catch {
      void fetchAll();
      return tx('Aktiv setzen hat nicht geklappt.');
    }
  };

  const crud = useEntityCrud(data, {
    footer: (top) => top.type === 'interaktionen' && !top.record.fields.aktiv
      ? {
          label: tx('Aktiv setzen & QR-Code zeigen'),
          onClick: () => {
            window.open(viewHref('qr-code', top.record.record_id), '_blank', 'noopener');
            void activate(top.record);
          },
        }
      : undefined,
  });
  const enrichedInteraktionen = crud.enriched.interaktionen;
  const enrichedZusammenfassungen = crud.enriched.zusammenfassungen;
  const enrichedBewertungen = crud.enriched.abschlussbewertungen;

  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const events = useMemo(
    () => [...veranstaltungen].sort((a, b) => (b.fields.datum ?? '').localeCompare(a.fields.datum ?? '')),
    [veranstaltungen]);
  const activeIds = useMemo(() => new Set(interaktionen.filter(i => i.fields.aktiv).map(i => i.record_id)), [interaktionen]);
  const activeEventIds = useMemo(
    () => new Set(interaktionen.filter(i => i.fields.aktiv).map(i => extractRecordId(i.fields.veranstaltung))),
    [interaktionen]);
  const eventId = events.some(e => e.record_id === selectedEvent)
    ? selectedEvent!
    : (events.find(e => activeEventIds.has(e.record_id)) ?? events[0])?.record_id ?? null;
  const event = events.find(e => e.record_id === eventId) ?? null;

  const feedbackCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of feedbacks) {
      const id = extractRecordId(f.fields.interaktion);
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [feedbacks]);
  // newest summary per interaction
  const summaryOf = useMemo(() => {
    const m = new Map<string, (typeof enrichedZusammenfassungen)[number]>();
    for (const z of enrichedZusammenfassungen) {
      const id = extractRecordId(z.fields.interaktion);
      if (!id) continue;
      const prev = m.get(id);
      if (!prev || (z.createdat ?? '') > (prev.createdat ?? '')) m.set(id, z);
    }
    return m;
  }, [enrichedZusammenfassungen]);

  const withoutAnswer = useMemo(
    () => [...summaryOf.values()].filter(z => !(z.fields.ki_antwort ?? '').trim()),
    [summaryOf]);
  const newRatings = useMemo(
    () => enrichedBewertungen
      .filter(b => differenceInDays(clock, parseISO(b.createdat)) < 7)
      .sort((a, b) => (b.createdat ?? '').localeCompare(a.createdat ?? '')),
    [enrichedBewertungen, clock]);
  const activeRecords = enrichedInteraktionen.filter(i => i.fields.aktiv);
  const activeFeedbackTotal = activeRecords.reduce((n, i) => n + (feedbackCount.get(i.record_id) ?? 0), 0);

  const steps = useMemo(() => enrichedInteraktionen
    .filter(i => extractRecordId(i.fields.veranstaltung) === eventId)
    .filter(i => filter === 'noAnswer' ? withoutAnswer.some(z => extractRecordId(z.fields.interaktion) === i.record_id) : true)
    .sort((a, b) => (a.fields.reihenfolge ?? 0) - (b.fields.reihenfolge ?? 0)),
  [enrichedInteraktionen, eventId, filter, withoutAnswer]);
  const nextOrder = Math.max(0, ...interaktionen.filter(i => extractRecordId(i.fields.veranstaltung) === eventId).map(i => i.fields.reihenfolge ?? 0)) + 1;

  const activeNow = activeRecords[0];
  const line = activeNow
    ? tx`${activeNow.veranstaltungName} läuft — gerade aktiv: „${(activeNow.fields.frage ?? '').slice(0, 60)}“.`
    : events.length > 0
      ? tx`Noch keine Interaktion aktiv — wähle eine aus und zeige den QR-Code.`
      : tx`Lege deine erste Veranstaltung an.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{line}</p>
        </div>
        {crud.veranstaltungen.canWrite && (
          <Button onClick={() => crud.veranstaltungen.openCreate({})}>
            <IconPlus size={16} className="shrink-0" /> {tx('Neue Veranstaltung')}
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        kpis={events.length > 0 ? (
          <StatStrip>
            <StatStripItem
              title={tx('Läuft gerade')}
              value={`${activeEventIds.size}/${events.length}`}
              icon={<IconPlayerPlay size={16} className="text-muted-foreground" />}
              tone={activeEventIds.size > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Feedbacks (aktiv)')}
              value={activeFeedbackTotal}
              icon={<IconMessage size={16} className="text-muted-foreground" />}
              onClick={activeNow ? () => crud.interaktionen.openDetail(activeNow) : undefined}
            />
            <StatStripItem
              title={tx('Ohne KI-Antwort')}
              value={withoutAnswer.length}
              icon={<IconSparkles size={16} className="text-muted-foreground" />}
              tone={withoutAnswer.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'noAnswer' ? 'all' : 'noAnswer')}
              active={filter === 'noAnswer'}
            />
            <StatStripItem
              title={tx('Neue Bewertungen')}
              value={newRatings.length}
              icon={<IconStar size={16} className="text-muted-foreground" />}
              onClick={newRatings[0] ? () => crud.abschlussbewertungen.openDetail(newRatings[0]) : undefined}
            />
          </StatStrip>
        ) : undefined}
        primary={events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 overflow-hidden rounded-[27px] bg-card p-8 text-center shadow-sm">
            <IconCalendarEvent size={48} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{tx('Noch keine Veranstaltung — lege eine an und füge ihre Interaktionen in Reihenfolge hinzu.')}</p>
            {crud.veranstaltungen.canWrite && (
              <Button onClick={() => crud.veranstaltungen.openCreate({})}>{tx('Erste Veranstaltung anlegen')}</Button>
            )}
          </div>
        ) : (
          <section className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {events.map(e => (
                <Button
                  key={e.record_id}
                  size="sm"
                  variant={e.record_id === eventId ? 'default' : 'outline'}
                  className="shrink-0"
                  onClick={() => setSelectedEvent(e.record_id)}
                >
                  {activeEventIds.has(e.record_id) && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />}
                  {e.fields.titel}{e.fields.datum ? ` · ${formatDate(e.fields.datum)}` : ''}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="min-w-0 truncate text-lg font-semibold">{appLabel('interaktionen')}{event ? ` — ${event.fields.titel ?? ''}` : ''}</h2>
              {crud.interaktionen.canWrite && eventId && (
                <Button size="sm" variant="outline" onClick={() => crud.interaktionen.openCreate({ veranstaltung: eventId, reihenfolge: nextOrder })}>
                  <IconPlus size={14} className="shrink-0" /> {tx('Neue Interaktion')}
                </Button>
              )}
            </div>
            {steps.length === 0 && (
              <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground">
                {filter === 'noAnswer' ? tx('Alles beantwortet — keine Zusammenfassung wartet auf eine KI-Antwort.') : tx('Diese Veranstaltung hat noch keine Interaktionen.')}
              </p>
            )}
            <ul className="space-y-3">
              {steps.map(i => {
                const active = activeIds.has(i.record_id);
                const n = feedbackCount.get(i.record_id) ?? 0;
                const sum = summaryOf.get(i.record_id);
                return (
                  <li key={i.record_id} className={`overflow-hidden rounded-2xl bg-card p-4 shadow-sm ${active ? 'ring-2 ring-emerald-500' : ''}`}>
                    <div role="button" tabIndex={0} className="flex min-w-0 cursor-pointer items-start gap-3"
                      onClick={() => crud.interaktionen.openDetail(i)}
                      onKeyDown={e => { if (e.key === 'Enter') crud.interaktionen.openDetail(i); }}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{i.fields.reihenfolge}</span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-medium">{i.fields.frage}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {active && <span className="font-medium text-emerald-600">{tx('Aktiv')} · </span>}
                          {countOf('feedbacks', n, appLabel('feedbacks'))}
                          {sum && !(sum.fields.ki_antwort ?? '').trim() && <span> · <span className="text-amber-600">{tx('KI-Antwort fehlt')}</span></span>}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant={active ? 'outline' : 'default'}>
                        <a href={viewHref('qr-code', i.record_id)} target="_blank" rel="noopener"
                          onClick={() => { if (!active && crud.interaktionen.canWrite) void activate(i); }}>
                          <IconQrcode size={14} className="shrink-0" /> {active ? tx('QR-Code zeigen') : tx('Aktiv setzen')}
                        </a>
                      </Button>
                      {sum ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={`#/ansicht/zusammenfassung?record=${sum.record_id}`} target="_blank" rel="noopener">
                            <IconSparkles size={14} className="shrink-0" /> {tx('Zusammenfassen')}
                          </a>
                        </Button>
                      ) : crud.zusammenfassungen.canWrite && (
                        <Button size="sm" variant="outline" onClick={() => crud.zusammenfassungen.openCreate({ interaktion: i.record_id, erstellt_am: format(clock, "yyyy-MM-dd'T'HH:mm") })}>
                          <IconSparkles size={14} className="shrink-0" /> {tx('Zusammenfassen')}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        aside={events.length > 0 ? (
          <>
            <WorkList
              title={tx('Zusammenfassungen ohne KI-Antwort')}
              items={withoutAnswer.map(z => ({
                id: z.record_id,
                title: z.interaktionName,
                secondLine: <span className="text-muted-foreground">{z.fields.erstellt_am ? formatDate(z.fields.erstellt_am) : formatDate(z.createdat)}</span>,
                action: (() => {
                  const go = flowActionFor('zusammenfassungen', 'ki_antwort', z.record_id);
                  return go ? { label: tx('Antwort ablegen'), onClick: go } : undefined;
                })(),
              }))}
              onItemClick={id => { const z = zusammenfassungen.find(r => r.record_id === id); if (z) crud.zusammenfassungen.openDetail(z); }}
              empty={{ text: tx('Alle Zusammenfassungen haben eine KI-Antwort.') }}
            />
            <WorkList
              title={tx('Neue Abschlussbewertungen')}
              items={newRatings.map(b => ({
                id: b.record_id,
                title: b.fields.kuerzel ?? b.veranstaltungName,
                secondLine: <span className="line-clamp-1 text-muted-foreground">{b.fields.referenzstatement || b.fields.besonders_toll || b.veranstaltungName}</span>,
              }))}
              onItemClick={id => { const b = abschlussbewertungen.find(r => r.record_id === id); if (b) crud.abschlussbewertungen.openDetail(b); }}
              empty={{ text: abschlussbewertungen.length > 0 ? tx`Letzte Bewertung am ${formatDate(format(parseISO(abschlussbewertungen[0].createdat), 'yyyy-MM-dd'))}` : tx('Noch keine Abschlussbewertung eingegangen.') }}
            />
          </>
        ) : undefined}
      />
      {crud.surfaces}
    </div>
  );
}
