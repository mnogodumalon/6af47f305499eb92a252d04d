import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm,
  useJourneySubmit,
  useLiveList,
  useVisitorKey,
  fieldText,
} from '@/lib/journey';
import { Bound } from '@/components/blocks/Bound';
import { FieldErrorSummary } from '@/components/blocks/FieldErrorSummary';
import { LoadProblem } from '@/components/blocks/LoadProblem';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Button } from '@/components/ui/button';
import { tx } from '@/i18n';

const SLUG = 'abschlussbewertung';

export default function Abschlussbewertung() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  return <Inner cfg={cfg} page={page} />;
}

function Inner({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [params] = useSearchParams();
  const veranstaltungId = params.get('veranstaltung');
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const kuerzel = useVisitorKey();
  const live = useLiveList(port, 'veranstaltungen', { intervalMs: 0, enabled: !!veranstaltungId });

  const f = useStepForm('abschlussbewertungen', {
    fields: ['besonders_toll', 'verbesserung', 'referenzstatement', 'email', 'einwilligung'],
    required: { besonders_toll: true },
    autoComplete: true,
  });
  const submit = useJourneySubmit(
    port,
    [
      {
        key: 'bewertung',
        entity: 'abschlussbewertungen',
        form: f,
        primary: true,
        values: () => ({ veranstaltung: veranstaltungId ?? '', kuerzel: kuerzel }),
      },
    ],
    { draftKey: `abschlussbewertung-${veranstaltungId ?? 'none'}` },
  );

  const title = tx('Deine Abschlussbewertung');

  if (!veranstaltungId) {
    return (
      <PublicShell title={title}>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link ist unvollständig. Scanne bitte den QR-Code der Veranstaltung noch einmal.')}
        </p>
      </PublicShell>
    );
  }
  if (!live.loaded && live.error) {
    return (
      <PublicShell title={title}>
        <LoadProblem onRetry={live.reload} />
      </PublicShell>
    );
  }
  if (!live.loaded) return <PublicShell loading />;

  const veranstaltung = live.records.find(r => r.id === veranstaltungId);
  if (!veranstaltung) {
    return (
      <PublicShell title={title}>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link passt zu keiner Veranstaltung. Scanne bitte den QR-Code noch einmal.')}
        </p>
      </PublicShell>
    );
  }

  const name = fieldText(veranstaltung, 'titel');
  const datum = fieldText(veranstaltung, 'datum');
  const subtitle = datum ? `${name} · ${datum}` : name;

  if (submit.result) {
    return (
      <PublicShell title={title} description={subtitle}>
        <SuccessStep
          result={submit.result}
          forms={[]}
          title={tx('Danke für deine Bewertung!')}
          whatHappensNext={tx('Dein Feedback hilft uns, die nächste Veranstaltung noch besser zu machen.')}
        >
          <p className="mt-4 text-sm">
            <Link
              to={`/public/feedback?veranstaltung=${veranstaltungId}`}
              className="font-medium text-primary underline underline-offset-2"
            >
              {tx('Feedback zur aktiven Interaktion abgeben')}
            </Link>
          </p>
        </SuccessStep>
      </PublicShell>
    );
  }

  const values = f.values as Record<string, unknown>;
  const showConsentNote =
    typeof values.email === 'string' && values.email.trim() !== '' && values.einwilligung !== true;

  const send = async () => {
    if (!f.validate()) return;
    await submit.run();
  };

  return (
    <PublicShell title={title} description={subtitle}>
      <form
        className="space-y-5"
        onSubmit={e => {
          e.preventDefault();
          void send();
        }}
      >
        <Bound form={f} name="besonders_toll" rows={4} />
        <Bound form={f} name="verbesserung" rows={4} />
        <Bound
          form={f}
          name="referenzstatement"
          rows={3}
          hint={tx('Ein, zwei Sätze, die wir als Empfehlung weitergeben dürfen.')}
        />

        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            {tx('Freiwillig: Hinterlasse deine E-Mail-Adresse, wenn du eine persönliche Auswertung möchtest. Sie wird mit dem Kürzel deines Handys verknüpft.')}
          </p>
          <Bound form={f} name="email" />
          <Bound form={f} name="einwilligung" />
          {showConsentNote && (
            <p className="text-sm text-muted-foreground">
              {tx('Ohne Häkchen speichern wir deine E-Mail nicht.')}
            </p>
          )}
        </div>

        <FieldErrorSummary forms={[f]} />
        {submit.offline && (
          <p className="text-sm text-muted-foreground">
            {tx('Keine Verbindung — deine Eingaben sind gesichert.')}
          </p>
        )}
        {submit.error && !submit.offline && (
          <p className="text-sm text-destructive">{tx('Das Senden hat nicht geklappt. Bitte versuche es noch einmal.')}</p>
        )}
        <Button type="submit" className="w-full" disabled={submit.submitting}>
          {tx('Bewertung absenden')}
        </Button>
      </form>
    </PublicShell>
  );
}
