/**
 * Interaktion aktivieren — 3-Schritt-Wizard plus QR-Code im eigenen Tab.
 * Steps: 1) Veranstaltung wählen → 2) Interaktion der Veranstaltung wählen → 3) Aktiv setzen bestätigen
 * → nach dem Erfolg öffnet sich der QR-Code bildschirmfüllend in einem eigenen Tab.
 * Reads: veranstaltungen, interaktionen. Writes: interaktionen (aktiv setzen, via useInteraktionAktivierenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IconQrcode } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldLookup, fieldNumber, fieldRef, fieldText, useLiveList } from '@/lib/journey';
import { useInteraktionAktivierenFlow } from '@/lib/journey/flows/InteraktionAktivieren';
import { tx } from '@/i18n';

export default function InteraktionAktivierenPage() {
  const [step, setStep] = useState(1);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');

  const flow = useInteraktionAktivierenFlow({
    steps: { interaktionen: 2 },
    items: {
      interaktionen: r => ({
        id: r.id,
        title: fieldText(r, 'frage'),
        subtitle: `${tx('Reihenfolge')} ${fieldNumber(r, 'reihenfolge') ?? '–'}`,
        status: fieldLookup(r, 'aktiv') ?? undefined,
      }),
    },
    where: {
      interaktionen: r => !eventId || fieldRef(r, 'veranstaltung') === eventId,
    },
  });

  const events = useLiveList(flow.port, 'veranstaltungen', { intervalMs: 0 });
  const eventItems = events.records.map(r => ({
    id: r.id,
    title: fieldText(r, 'titel'),
    subtitle: fieldDate(r, 'datum') ?? undefined,
  }));

  const qrUrl = flow.submit.result
    ? `${window.location.origin}${window.location.pathname}#/ansicht/qr-code?record=${flow.submit.result.primary.id}`
    : null;

  return (
    <IntentWizardShell
      title={tx('Interaktion aktivieren')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{ description: tx('Eine Interaktion deiner Veranstaltung live schalten und den QR-Code zeigen.') }}
    >
      <WizardStep label={tx('Veranstaltung')} description={tx('Für welche Veranstaltung willst du eine Interaktion aktivieren?')}>
        <EntitySelectStep
          items={eventItems}
          loading={events.loading && !events.loaded}
          error={events.error ? tx('Die Veranstaltungen konnten nicht geladen werden.') : null}
          create={false}
          selectedId={eventId}
          onSelect={id => {
            setEventId(id);
            setEventName(eventItems.find(e => e.id === id)?.title ?? '');
            setStep(2);
          }}
        />
      </WizardStep>
      <WizardStep label={tx('Interaktion')} description={tx('Welche Interaktion soll jetzt aktiv sein? Die bisher aktive wird inaktiv.')}>
        {eventId ? (
          <EntitySelectStep
            {...flow.picks.interaktionen.select}
            {...flow.pick('interaktionen')}
            emptyText={tx`Zu „${eventName}“ gibt es noch keine Interaktion.`}
            searchPlaceholder={tx('Frage suchen …')}
          />
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Dieser Schritt braucht zuerst die Veranstaltung aus Schritt 1.')}
          </StepNav>
        )}
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Die Interaktion wird aktiv, die bisher aktive derselben Veranstaltung wird inaktiv. Danach öffnest du den QR-Code in einem eigenen Tab.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          undo={flow.undo}
          next={[
            { label: tx('Feedbacks zusammenfassen'), href: '#/intents/feedbacks-zusammenfassen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Öffne den QR-Code in einem eigenen Tab und zeige ihn bildschirmfüllend deinem Publikum.')}
        >
          {qrUrl && (
            <Button type="button" onClick={() => window.open(qrUrl, '_blank', 'noopener')}>
              <IconQrcode size={16} className="shrink-0" />
              {tx('QR-Code in eigenem Tab öffnen')}
            </Button>
          )}
        </SuccessStep>
      )}
    </IntentWizardShell>
  );
}
