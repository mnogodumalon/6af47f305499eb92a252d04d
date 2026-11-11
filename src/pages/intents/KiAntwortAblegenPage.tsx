/**
 * KI-Antwort ablegen — 3-Schritt-Wizard.
 * Steps: 1) Zusammenfassung der Interaktion wählen → 2) Antwort der KI einfügen → 3) Prüfen & speichern.
 * Reads: zusammenfassungen (interaktion, zusammenfassung_text, ki_antwort, erstellt_am). Writes: zusammenfassungen.ki_antwort (update).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText } from '@/lib/journey';
import { useKiAntwortAblegenFlow } from '@/lib/journey/flows/KiAntwortAblegen';
import { tx } from '@/i18n';

export default function KiAntwortAblegenPage() {
  const [step, setStep] = useState(1);
  const flow = useKiAntwortAblegenFlow({
    steps: { zusammenfassungen: 1, ki_antwort: 2 },
    items: {
      zusammenfassungen: (z, ctx) => {
        const text = fieldText(z, 'zusammenfassung_text');
        const antwort = fieldText(z, 'ki_antwort');
        return {
          id: z.id,
          title: ctx.ref('interaktion') ?? tx('Zusammenfassung ohne Interaktion'),
          subtitle: antwort ? tx('Antwort schon vorhanden — wird überschrieben') : text.slice(0, 120),
        };
      },
    },
  });

  return (
    <IntentWizardShell
      title={tx('KI-Antwort ablegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Die Antwort des Chatbots bei der passenden Zusammenfassung ablegen.'),
        needs: [tx('Die kopierte Antwort der KI')],
      }}
    >
      <WizardStep label={tx('Zusammenfassung')} description={tx('Zu welcher Interaktion gehört die Antwort der KI?')}>
        <EntitySelectStep
          {...flow.picks.zusammenfassungen.select}
          {...flow.pick('zusammenfassungen')}
          searchPlaceholder={tx('Zusammenfassung suchen …')}
        />
      </WizardStep>
      <WizardStep label={tx('Antwort')} description={tx('Füge die Antwort des Chatbots hier ein.')} needs={['interaktion']}>
        <Bound form={flow.forms.zusammenfassungen} name="ki_antwort" rows={12} />
        <StepNav
          onBack={() => setStep(1)}
          onNext={() => flow.validateStep(2)}
          nextStepLabel={tx('Prüfen')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Die Antwort der KI wird bei der Zusammenfassung gespeichert.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Die Antwort steht jetzt bei der Zusammenfassung bereit.')}
          next={[
            { label: tx('Interaktion aktiv setzen'), href: '#/intents/interaktion-aktivieren' },
            { label: tx('Feedbacks zusammenfassen'), href: '#/intents/feedbacks-zusammenfassen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
